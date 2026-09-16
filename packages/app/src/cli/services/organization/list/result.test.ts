import {writeOrganizationListResult} from './result.js'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest: () => false,
}))

const ORGANIZATION_1 = {
  id: '123',
  gid: 'gid://organization/Organization/123',
  name: 'Test Organization',
  status: 'ACTIVE' as const,
  shopCount: 3,
  url: 'https://admin.shopify.com/organization/123',
}

const ORGANIZATION_2 = {
  id: '456',
  gid: 'gid://organization/Organization/456',
  name: 'Another Organization',
  status: 'LOCKED' as const,
  shopCount: null,
  url: 'https://admin.shopify.com/organization/456',
}

describe('writeOrganizationListResult', () => {
  test('renders a table with organization id and name in text format', () => {
    writeOrganizationListResult({organizations: [ORGANIZATION_1, ORGANIZATION_2]}, 'text')

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

  test('writes the exact JSON document to stdout and nothing to stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    writeOrganizationListResult({organizations: [ORGANIZATION_1]}, 'json')

    const stdoutContent = stdout.mock.calls.map(([content]) => String(content)).join('')

    const expectedJson = `{
  "organizations": [
    {
      "id": "123",
      "gid": "gid://organization/Organization/123",
      "name": "Test Organization",
      "status": "ACTIVE",
      "shopCount": 3,
      "url": "https://admin.shopify.com/organization/123"
    }
  ]
}`

    expect(stdout).toHaveBeenCalledOnce()
    expect(stdoutContent).toBe(`${expectedJson}\n`)
    expect(stderr).not.toHaveBeenCalled()
  })
})
