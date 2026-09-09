import OrganizationList from './list.js'
import {
  organizationList,
  organizationListJsonOutputSchema,
  type OrganizationListResult,
} from '../../services/organization/list.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/organization/list.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/organization/list.js')>()
  return {...actual, organizationList: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

const RESULT: OrganizationListResult = {
  organizations: [
    {id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'},
    {id: '456', gid: 'gid://organization/Organization/456', name: 'Another Organization'},
  ],
}

describe('organization list command', () => {
  test('exposes the organization list JSON schema', () => {
    expect(OrganizationList.jsonOutputSchema).toBe(organizationListJsonOutputSchema)
  })

  test('renders the organization table by default', async () => {
    vi.mocked(organizationList).mockResolvedValue(RESULT)

    await OrganizationList.run([], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith()
    expect(renderTable).toHaveBeenCalledWith({
      rows: [
        {id: '123', name: 'Test Organization'},
        {id: '456', name: 'Another Organization'},
      ],
      columns: {
        id: {header: 'ID'},
        name: {header: 'NAME'},
      },
    })
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs the encoded JSON document when --json is passed', async () => {
    vi.mocked(organizationList).mockResolvedValue(RESULT)

    await OrganizationList.run(['--json'], import.meta.url)

    expect(organizationList).toHaveBeenCalledWith()
    expect(outputResult).toHaveBeenCalledWith(organizationListJsonOutputSchema.encode(RESULT))
    expect(renderTable).not.toHaveBeenCalled()
  })

  test('outputs the encoded JSON document when -j is passed', async () => {
    vi.mocked(organizationList).mockResolvedValue(RESULT)

    await OrganizationList.run(['-j'], import.meta.url)

    expect(outputResult).toHaveBeenCalledWith(organizationListJsonOutputSchema.encode(RESULT))
  })

  test('returns an empty JSON array when NoOrgError is thrown in JSON mode', async () => {
    vi.mocked(organizationList).mockRejectedValue(new NoOrgError({type: 'UserAccount', email: 'test@example.com'}))

    await OrganizationList.run(['--json'], import.meta.url)

    expect(outputResult).toHaveBeenCalledWith(organizationListJsonOutputSchema.encode({organizations: []}))
  })

  test('uses standard error handling for NoOrgError in table mode', async () => {
    vi.mocked(organizationList).mockRejectedValue(new NoOrgError({type: 'UserAccount', email: 'test@example.com'}))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(OrganizationList.run([], import.meta.url)).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )
      expect(outputResult).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
