import {writeOrganizationListResult} from './result.js'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest: () => false,
}))

describe('writeOrganizationListResult', () => {
  test('renders a table with organization id and name in text format', () => {
    writeOrganizationListResult(
      {
        organizations: [
          {id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'},
          {id: '456', gid: 'gid://organization/Organization/456', name: 'Another Organization'},
        ],
      },
      'text',
    )

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
  })

  test('writes one JSON document to stdout and nothing to stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    writeOrganizationListResult(
      {
        organizations: [{id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'}],
      },
      'json',
    )

    const stdoutContent = stdout.mock.calls.map(([content]) => String(content)).join('')

    expect(stdout).toHaveBeenCalledOnce()
    expect(JSON.parse(stdoutContent)).toEqual({
      organizations: [{id: '123', gid: 'gid://organization/Organization/123', name: 'Test Organization'}],
    })
    expect(stderr).not.toHaveBeenCalled()
  })
})
