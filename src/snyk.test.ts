import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import mock from 'mock-require'
const sourcegraph = createStubSourcegraphAPI()
mock('sourcegraph', sourcegraph)

import { getClosestProject, } from './snyk'
import * as assert from 'assert'

describe('snyk', () => {
    describe('getClosestPackageJSON()', () => {
        it('works when TODO', () => {
            assert.strictEqual(getClosestProject('', '', []), 'TODO')
        })
    })

    // packageToAuditBody()

    // auditResponseToMarkdown()
})
