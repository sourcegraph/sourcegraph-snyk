export interface ApiOptions {
    snykApiUrl: URL

    /** API authentication token */
    apiToken: string
}

export interface AllProjectsResponse {
    org: {
        name: string
        id: string
    }
    projects: Project[]
}

export interface Project {
    name: string
    id: string
    created: string
    origin: string
    type: string
    readOnly: string
    testFrequency: string
    totalDependencies: number
    issueCountsBySeverity: {
        low: number
        high: number
        medium: number
    }
    remoteRepoUrl?: string
    lastTestedDate: string
    browseUrl?: string
    importingUser: {
        id: string
        name: string
        username: string
        email: string
    }
    isMonitored: boolean
    owner: { id: string; name: string; username: string; email: string }
    branch: string
    tags: { key: string; value: string }[]
}

export interface ProjectIssues {
    issues: Issue[]
}

export interface Issue {
    id: string
    issueType: string
    pkgName: string
    pkgVersions: string[]
    issueData: {
        id: string
        title: string
        severity: 'low' | 'medium' | 'high'
        url: string
        description: string
        identifiers: {
            CVE: string[]
            CWE: string[]
            ALTERNATIVE: string[]
        }
        credit: string[]
        exploitMaturity: string
        semver: Record<string, string[]>
        publicationTime: string
        disclosureTime: string
        CVSSv3: string
        cvssScore: number
        language: string
        patches: { id: string; urls: string[]; version: string; comments: string[]; modificationTime: string }[]
        nearestFixedInVersion: string
    }
    isPatched: boolean
    isIgnored: boolean
    fixInfo: { isUpgradable: boolean; isPinnable: boolean; isPatchable: boolean; nearestFixedInVersion: string }
    priority: {
        score: number
        factors: { name: string; description: string }[]
    }
}

async function fetchApi(path: string, options: ApiOptions, init?: RequestInit): Promise<any> {
    const url = new URL(path, options.snykApiUrl)
    console.log({
        optURL: options.snykApiUrl.href,
        genURL: url.href,
    })
    const headers = new Headers()
    headers.set('Authorization', 'token ' + options.apiToken)
    const response = await fetch(url.href, { headers, ...init })
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    const result = await response.json()
    return result
}

export const listAllProjects = memoizeAsync(
    async ({ orgId, options }: { orgId: string; options: ApiOptions }): Promise<AllProjectsResponse> =>
        fetchApi(`api/v1/org/${encodeURIComponent(orgId)}/projects`, options, { method: 'POST' }),
    ({ orgId, options }) => `${orgId}-${options.apiToken}`
)

// Don't memoize this as it can change more often (commits)
export async function listAggregatedProjectIssues(
    orgId: string,
    projectId: string,
    options: ApiOptions
): Promise<{ issues: Issue[] }> {
    return fetchApi(
        `api/v1/org/${encodeURIComponent(orgId)}/project/${encodeURI(projectId)}/aggregated-issues`,
        options,
        { method: 'POST' }
    )
}

interface OrgsListResponse {
    orgs: { name: string; id: string; slug: string; url: string; group: null | { name: string; id: string } }[]
}

export const getUserOrgs = memoizeAsync(
    async (options: ApiOptions): Promise<OrgsListResponse> => fetchApi('api/v1/orgs', options),
    options => options.apiToken
)

/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param func The function to memoize
 * @param toKey Determines the cache key for storing the result based on the first argument provided to the memoized
 * function
 */
function memoizeAsync<P, T>(
    func: (parameters: P) => Promise<T>,
    toKey: (parameters: P) => string
): (parameters: P) => Promise<T> {
    const cache = new Map<string, Promise<T>>()
    return (parameters: P) => {
        const key = toKey(parameters)
        const hit = cache.get(key)
        if (hit) {
            return hit
        }
        const promise = func(parameters)
        promise.then(null, () => cache.delete(key))
        cache.set(key, promise)
        return promise
    }
}
