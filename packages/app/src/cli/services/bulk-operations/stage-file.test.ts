import {stageFile} from './stage-file.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {readFile, fileSize} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/http')

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

  beforeEach(() => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from(mockFileContents))
    vi.mocked(fileSize).mockResolvedValue(mockFileSize)
    vi.mocked(formData).mockReturnValue({
      append: vi.fn(),
    } as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    } as any)
  })

  test('returns staged upload key when file is successfully staged with empty variables', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const result = await stageFile({
      adminSession: mockSession,
      jsonVariables: [],
    })

    expect(result).toBe('test-key')
  })

  test('converts JSON strings array to JSONL format when uploading file', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)
    const mockAppend = vi.fn()
    vi.mocked(formData).mockReturnValue({append: mockAppend} as any)

    const jsonVariables = ['{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}']

    await stageFile({
      adminSession: mockSession,
      jsonVariables,
    })

    // Find the form.append('file', buffer, options) call among all append calls
    const fileAppendCall = mockAppend.mock.calls.find((call) => {
      const fieldName = call[0]
      return fieldName === 'file'
    })
    // Extract the buffer (second argument) that was uploaded
    const uploadedBuffer = fileAppendCall?.[1]
    const uploadedContent = uploadedBuffer?.toString('utf-8')

    expect(uploadedContent).toBe('{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}\n')
  })

  test('handles multiple JSON variable strings correctly', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)
    const mockAppend = vi.fn()
    vi.mocked(formData).mockReturnValue({append: mockAppend} as any)

    const jsonVariables = [
      '{"input":{"id":"gid://shopify/Product/1","title":"New Shirt"}}',
      '{"input":{"id":"gid://shopify/Product/2","title":"Cool Pants"}}',
      '{"input":{"id":"gid://shopify/Product/3","title":"Nice Hat"}}',
    ]

    await stageFile({
      adminSession: mockSession,
      jsonVariables,
    })

    const fileAppendCall = mockAppend.mock.calls.find((call) => {
      const fieldName = call[0]
      return fieldName === 'file'
    })
    const uploadedBuffer = fileAppendCall?.[1]
    const uploadedContent = uploadedBuffer?.toString('utf-8')

    const expectedContent = [
      '{"input":{"id":"gid://shopify/Product/1","title":"New Shirt"}}',
      '{"input":{"id":"gid://shopify/Product/2","title":"Cool Pants"}}',
      '{"input":{"id":"gid://shopify/Product/3","title":"Nice Hat"}}',
      '',
    ].join('\n')

    expect(uploadedContent).toBe(expectedContent)
  })
})
