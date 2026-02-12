import {stageFile} from './stage-file.js'
import {adminRequestDoc} from '@shopify/cli-kit/admin/api'
import {readFile, fileSize} from '@shopify/cli-kit/shared/node/fs'
import {fetch} from '@shopify/cli-kit/shared/node/http'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/admin/api')
vi.mock('@shopify/cli-kit/identity/session')
vi.mock('@shopify/cli-kit/shared/node/fs')
vi.mock('@shopify/cli-kit/shared/node/http')

describe('stageFile', () => {
  const mockSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
  const mockFileContents = '{"id":"gid://shopify/Product/123","title":"Test"}'
  const mockFileSize = 52
  const mockUploadUrl = 'https://storage.googleapis.com/test-bucket/test-file'
  const mockResourceUrl = 'tmp/staged-uploads/test-resource.jsonl'

  const mockSuccessResponse = {
    stagedUploadsCreate: {
      stagedTargets: [
        {
          url: mockUploadUrl,
          resourceUrl: mockResourceUrl,
          parameters: [
            {name: 'key', value: 'test-key'},
            {name: 'policy', value: 'test-policy'},
          ],
        },
      ],
      userErrors: [],
    },
  }

  let formDataAppendSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from(mockFileContents))
    vi.mocked(fileSize).mockResolvedValue(mockFileSize)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    } as any)
    formDataAppendSpy = vi.spyOn(FormData.prototype, 'append')
  })

  test('returns staged upload key when file is successfully staged with no variables', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const result = await stageFile({
      adminSession: mockSession,
      variablesJsonl: undefined,
    })

    expect(result).toBe('test-key')
  })

  test('converts JSONL string to buffer when uploading file', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const variablesJsonl = '{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}'

    await stageFile({
      adminSession: mockSession,
      variablesJsonl,
    })

    const fileAppendCall = formDataAppendSpy.mock.calls.find((call) => call[0] === 'file')
    const uploadedBlob = fileAppendCall?.[1] as Blob
    const uploadedContent = await uploadedBlob?.text()

    expect(uploadedContent).toBe('{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}')
  })

  test('handles JSONL with multiple lines correctly', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const variablesJsonl = [
      '{"input":{"id":"gid://shopify/Product/1","title":"New Shirt"}}',
      '{"input":{"id":"gid://shopify/Product/2","title":"Cool Pants"}}',
      '{"input":{"id":"gid://shopify/Product/3","title":"Nice Hat"}}',
    ].join('\n')

    await stageFile({
      adminSession: mockSession,
      variablesJsonl,
    })

    const fileAppendCall = formDataAppendSpy.mock.calls.find((call) => call[0] === 'file')
    const uploadedBlob = fileAppendCall?.[1] as Blob
    const uploadedContent = await uploadedBlob?.text()

    const expectedContent = [
      '{"input":{"id":"gid://shopify/Product/1","title":"New Shirt"}}',
      '{"input":{"id":"gid://shopify/Product/2","title":"Cool Pants"}}',
      '{"input":{"id":"gid://shopify/Product/3","title":"Nice Hat"}}',
    ].join('\n')

    expect(uploadedContent).toBe(expectedContent)
  })
})
