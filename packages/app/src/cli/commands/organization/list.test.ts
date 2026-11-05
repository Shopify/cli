import OrganizationList from './list.js'
import * as organizationResult from '../../services/organization/list/result.js'
import {organizationList} from '../../services/organization/list.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../services/organization/list.js')

const organizations = [
  {
    id: '123',
    gid: 'gid://organization/Organization/123',
    name: 'Test Organization',
    status: 'ACTIVE' as const,
    shopCount: 3,
    url: 'https://admin.shopify.com/organization/123',
  },
]

describeJsonCommand({
  command: OrganizationList,
  commandId: 'organization:list',
  moduleURL: new URL('../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: {organizations},
  expectedSchema: {type: 'object', required: ['organizations'], additionalProperties: false},
  setup: () => {
    vi.mocked(organizationList).mockResolvedValue({organizations})
  },
  assertExecuted: () => {
    expect(organizationList).toHaveBeenCalledExactlyOnceWith()
  },
  assertNotExecuted: () => {
    expect(organizationList).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Test Organization')
    expect(stderr).toContain('123')
  },
})

describe('organization list command', () => {
  test('renders an empty JSON result when NoOrgError is thrown', async () => {
    vi.mocked(organizationList).mockRejectedValue(new NoOrgError({type: 'UserAccount', email: 'test@example.com'}))

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new OrganizationList(['--json'], await Config.load()).run()
      expect(JSON.parse(stdout())).toEqual({organizations: []})
      expect(stderr()).toBe('')
    })
  })

  test('passes NoOrgError to the shared error handler in text mode', async () => {
    const error = new NoOrgError({type: 'UserAccount', email: 'test@example.com'})
    vi.mocked(organizationList).mockRejectedValue(error)
    const catchError = vi.spyOn(OrganizationList.prototype, 'catch').mockRejectedValue(error)
    const writer = vi.spyOn(organizationResult, 'writeOrganizationListResult')

    await expect(OrganizationList.run([], import.meta.url)).rejects.toThrow(error)

    expect(catchError).toHaveBeenCalledWith(error)
    expect(writer).not.toHaveBeenCalled()
  })

  test('passes other errors to the shared error handler', async () => {
    const error = new Error('request failed')
    vi.mocked(organizationList).mockRejectedValue(error)
    const catchError = vi.spyOn(OrganizationList.prototype, 'catch').mockRejectedValue(error)
    const writer = vi.spyOn(organizationResult, 'writeOrganizationListResult')

    await expect(OrganizationList.run(['--json'], import.meta.url)).rejects.toThrow(error)

    expect(catchError).toHaveBeenCalledWith(error)
    expect(writer).not.toHaveBeenCalled()
  })
})
