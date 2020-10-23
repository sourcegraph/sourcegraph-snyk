import { combineLatest, EMPTY, from } from 'rxjs'
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { ApiOptions, getUserOrgs, listAggregatedProjectIssues, listAllProjects, Project, ProjectIssues } from './api'

interface Configuration {
    'snyk.corsAnywhereUrl'?: string
    'snyk.apiToken'?: string
    'snyk.repositoryNamePattern'?: string
    'snyk.organizationKeyTemplate'?: string
}

const getConfig = (): Configuration => sourcegraph.configuration.get<Configuration>().value

export function activate(context: sourcegraph.ExtensionContext): void {
    const panelView = sourcegraph.app.createPanelView('snyk.panel')
    panelView.title = 'Snyk'
    panelView.content = 'Open a file to see the Snyk report'

    // Don't show multiple alerts for the same project in the same session
    const shownProjectAlerts = new Set<string>()

    context.subscriptions.add(
        combineLatest([
            from(sourcegraph.app.activeWindowChanges).pipe(
                switchMap(activeWindow => activeWindow?.activeViewComponentChanges || EMPTY),
                filter((viewer): viewer is sourcegraph.CodeEditor => !!viewer && viewer.type === 'CodeEditor'),
                distinctUntilChanged((a, b) => a.document === b.document)
            ),
            from(sourcegraph.configuration).pipe(map(() => getConfig())),
        ])
            .pipe(
                tap(() => panelView.content = 'Loading...'),
                switchMap(async ([editor, config]) => {
                    try {
                        // Construct API Options
                        const corsAnywhereUrl = new URL(
                            (config['snyk.corsAnywhereUrl']?.replace(/\/$/, '') ||
                                'https://cors-anywhere.herokuapp.com') + '/'
                        )

                        const apiToken = config['snyk.apiToken']
                        if (!apiToken) {
                            throw new NoApiTokenError()
                        }

                        const snykBaseUrl = new URL('https://snyk.io/')
                        const apiOptions: ApiOptions = {
                            snykApiUrl: new URL(
                                `${corsAnywhereUrl.href.replace(/\/$/, '')}/${snykBaseUrl.href.replace(/\/$/, '')}/`
                            ),
                            apiToken,
                        }

                        panelView.content = 'Loading...'
                        const uri = new URL(editor.document.uri)
                        const shortRepoName = decodeURIComponent(uri.pathname).replace(/^\//, '')
                        const filePath = decodeURIComponent(uri.hash.slice(1))

                        const repositoryNamePattern = '(?:^|/)([^/]+)/([^/]+)$'
                        const repositoryNameMatch = shortRepoName.match(repositoryNamePattern)

                        if (!repositoryNameMatch) {
                            throw new Error(
                                `repositoryNamePattern ${repositoryNamePattern.toString()} did not match repository name ${shortRepoName}`
                            )
                        }

                        const organizationKeyTemplate = config['snyk.organizationKeyTemplate'] ?? '$1'
                        const orgId = organizationKeyTemplate.replace(
                            /\$(\d)/g,
                            (_substring, number: string) => repositoryNameMatch[+number]
                        )

                        // Get list of orgs that this user is part of
                        const orgsList = await getUserOrgs(apiOptions)
                        const org = orgsList.orgs.find(({ name }) => name === orgId)

                        if (!org) {
                            throw new OrgNotFoundError(orgId)
                        }

                        // Check if Snyk has info for this project. We need this step because shortRepoName is not a valid project ID
                        const allProjects = await listAllProjects({ orgId, options: apiOptions })

                        // Get the closest project to this file in this repo
                        const closestProject = getClosestProject(shortRepoName, filePath, allProjects.projects)

                        // Problems in big monorepos:
                        // - Could cause false positives for files of languages unsupported by Snyk: the closest
                        // manifest file would be for a different language.

                        if (!closestProject) {
                            throw new NoProjectFoundError(filePath, shortRepoName)
                        }

                        const projectIssues = await listAggregatedProjectIssues(orgId, closestProject.id, apiOptions)

                        // TODO: Only decorate lines on latest revision of default branch, since Snyk only monitors the default branch
                        // https://support.snyk.io/hc/en-us/articles/360001497578-Which-branch-does-Snyk-Monitor
                        // We should revisit this extension once we have support for uploading org-wide data
                        // so site-admins can upload Snyk cli test results, through which they can hack together
                        // branch support.

                        // const isDefaultBranch = await getIsDefaultBranch(commitID, fullRepoName)

                        // const dependencyNames: string[] = []
                        // const dependencyIndex: Record<string, number | undefined> = {}
                        // if (isDefaultBranch) {
                        //     // Merge patterns (predefined + user-defined)
                        //     const mergedImportPatterns = mergeImportPatterns(
                        //         predefinedPatterns,
                        //         config['snyk.importPatterns']
                        //     )
                        //     console.log('merged imppats', mergedImportPatterns)

                        //     const text = editor.document.text ?? ''
                        //     let match: RegExpExecArray | null = null

                        //     const patterns = mergedImportPatterns[editor.document.languageId]
                        //     if (patterns) {
                        //         for (let { pattern, matchIndex } of patterns) {
                        //             if (typeof pattern === 'string') {
                        //                 pattern = new RegExp(pattern)
                        //             }
                        //             while ((match = pattern.exec(text))) {
                        //                 const name = match[matchIndex]
                        //                 dependencyNames.push(name)
                        //                 dependencyIndex[name] = match.index
                        //             }
                        //         }
                        //     }
                        // }

                        return { editor, projectIssues, project: closestProject }
                    } catch (error) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        return { error }
                    }
                })
            )
            .subscribe(({ projectIssues, project, editor, error }) => {
                if (projectIssues && project) {
                    panelView.content = projectIssuesToMarkdown(project, projectIssues, project.browseUrl)

                    if (projectIssues.issues.length > 0 && !shownProjectAlerts.has(project.name)) {
                        sourcegraph.app.activeWindow?.showNotification(
                            `Snyk has found issues in the default branch${
                                project.branch ? ` (${project.branch})` : ''
                            } of project ${
                                project.name || editor?.document.uri || ''
                            }. See more info on [Sourcegraph](#tab=snyk.panel)${
                                project.browseUrl ? ` or [Snyk](${project.browseUrl})` : ''
                            }`,
                            sourcegraph.NotificationType.Warning
                        )
                        shownProjectAlerts.add(project.name)
                    }
                } else if (error) {
                    if (error instanceof NoApiTokenError) {
                        panelView.content = error.message
                        throw error
                    } else if (error instanceof NoProjectFoundError || error instanceof OrgNotFoundError) {
                        panelView.content = error.message
                        console.error(error.message)
                    } else {
                        panelView.content = 'Unknown error fetching issues for this project'
                        console.error(error)
                    }
                }
            })
    )
}

// function mergeImportPatterns(
//     predefinedPatterns: ImportPatternsByLanguage,
//     userDefinedPatterns?: ImportPatternsByLanguage
// ): ImportPatternsByLanguage {
//     if (!userDefinedPatterns) {
//         return predefinedPatterns
//     }

//     return deepmerge(predefinedPatterns, userDefinedPatterns)
// }

// async function getIsDefaultBranch(commitID: string, fullRepoName: string): Promise<boolean> {
//     try {
//         return false
//     } catch {
//         return false
//     }
// }

function projectIssuesToMarkdown(project: Project, projectIssues: ProjectIssues, browseUrl?: string): string {
    if (projectIssues.issues.length === 0) {
        return `No issues found for this project.${browseUrl ? ` [See the full report](${browseUrl})` : ''}`
    }

    let markdownString = ''

    markdownString += `### Issues found in ${project.name}` // TODO project name in title
    if (browseUrl) {
        markdownString += ` [(Read full report on Snyk)](${browseUrl})`
    }
    markdownString += '\n'

    for (const issue of projectIssues.issues) {
        console.log('issue', issue)
        markdownString += `\n\n#### [${issue.issueData.title}](${issue.issueData.url})\n- dependency: ${
            issue.pkgName
        }, version${issue.pkgVersions.length > 1 ? 's' : ''} ${issue.pkgVersions.join(', ')}\n- severity: ${
            issue.issueData.severity
        }\n\n`
    }

    return markdownString
}

function getClosestProject(shortRepoName: string, filePath: string, allProjects: Project[]): Project {
    // filter out projects wihout same repo name
    const projects = allProjects.filter(({ name }) => name.includes(shortRepoName))

    // get manifest file paths (maintain reference to project somehow.. id?)
    const projectsWithManifestPath = projects.map(project => ({
        ...project,
        manifestFilePath: project.name.split(shortRepoName)[1]?.replace(/^:/, ''),
    }))

    interface Tree {
        manifest?: { type: string; projectIndex: number }
        trees: Record<string, Tree | undefined>
    }

    const fileTree: { root: Tree } = { root: { trees: {} } }

    // construct file tree
    for (const [projectIndex, { manifestFilePath }] of projectsWithManifestPath.entries()) {
        if (manifestFilePath === undefined) {
            continue
        }
        const pathComponents = manifestFilePath.split('/')
        let cwd = fileTree.root
        for (const [componentIndex, component] of pathComponents.entries()) {
            // Last component, so this is a file
            if (componentIndex === pathComponents.length - 1) {
                cwd.manifest = { type: component, projectIndex }
                break
            }
            // If the tree doesn't already exist, create it
            const nextTree = cwd.trees[component] ?? { blobs: {}, trees: {} }
            // Reassign in case it didn't exist before
            cwd.trees[component] = nextTree
            cwd = nextTree
        }
    }

    // find lowest ancestor manifest
    let deepestAncestorManifest = 0
    let cwd: Tree | undefined = fileTree.root
    for (const component of filePath.split('/')) {
        if (!cwd) {
            break
        }
        const maybeManifest = cwd.manifest
        if (maybeManifest) {
            deepestAncestorManifest = maybeManifest.projectIndex
        }
        cwd = cwd.trees[component]
    }

    return projectsWithManifestPath[deepestAncestorManifest]
}

class NoProjectFoundError extends Error {
    public readonly name = 'NoProjectFoundError'
    constructor(filePath: string, shortRepoName: string) {
        super(`No Snyk project has been found for file: ${filePath} in repo: ${shortRepoName}`)
    }
}

class OrgNotFoundError extends Error {
    public readonly name = 'OrgNotFoundError'
    constructor(orgId: string) {
        super(`No org with id: ${orgId} has was found`)
    }
}

class NoApiTokenError extends Error {
    public readonly name = 'NoApiTokenError'
    public readonly message = 'No Synk API token found in user settings'
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
