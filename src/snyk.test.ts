import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import mock from 'mock-require'
const sourcegraph = createStubSourcegraphAPI()
mock('sourcegraph', sourcegraph)

import { getClosestProject } from './snyk'
import * as assert from 'assert'
import { Project } from './api'

describe('snyk', () => {
    describe('getClosestProject()', () => {
        const projects = [
            { name: 'sourcegraph/sourcegraph-snyk:client/shared/src/api/package.json' },
            { name: 'sourcegraph/sourcegraph:package.json' },
            { name: 'sourcegraph/sourcegraph:client/package.json' },
            { name: 'sourcegraph/sourcegraph:client/web/package.json' },
            { name: 'sourcegraph/sourcegraph:client/shared/package.json' },
        ] as Project[]
        const shortRepoName = 'sourcegraph/sourcegraph'

        it('works for files in a repository with multiple projects', () => {
            const filePath = 'client/shared/src/api/index.ts'
            assert.deepStrictEqual(getClosestProject(shortRepoName, filePath, projects), {
                name: 'sourcegraph/sourcegraph:client/shared/package.json',
                manifestFilePath: 'client/shared/package.json',
            })
        })

        it('works for directories in a repository with multiple projects', () => {
            const directoryPath = 'client'
            assert.deepStrictEqual(getClosestProject(shortRepoName, directoryPath, projects), {
                name: 'sourcegraph/sourcegraph:client/package.json',
                manifestFilePath: 'client/package.json'
            })
        })
    })
})
