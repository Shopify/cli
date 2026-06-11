import {
  CRAWLER_SIGNATURE_NAME,
  CRAWLER_SIGNATURE_TTL_SECONDS,
  crawlerSignatureHeaderDebugSummary,
  fetchOrCreateCrawlerSignatureHeaders,
} from './crawler-signature.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/output', async (realImport) => {
  const realModule = await realImport<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...realModule,
    outputDebug: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  recordError: vi.fn((error) => error),
}))

const adminSession = {
  token: 'admin-token',
  storeFqdn: 'store.myshopify.com',
}

const crawlerSignature = {
  id: 'gid://shopify/StorefrontCrawlerSignature/1',
  name: CRAWLER_SIGNATURE_NAME,
  domainHost: 'store.myshopify.com',
  signature: 'signature-value',
  signatureInput: 'signature-input-value',
  signatureAgent: 'signature-agent-value',
  expiresAt: '2026-07-01T00:00:00Z',
}

const emptyCrawlerSignaturesResponse = {
  storefrontCrawlerSignatures: {
    edges: [],
  },
}

describe('crawlerSignatureHeaderDebugSummary', () => {
  test('reports only crawler signature header names as present or missing', () => {
    const summary = crawlerSignatureHeaderDebugSummary({
      Signature: 'secret-signature-value',
      'Signature-Agent': 'secret-signature-agent-value',
      Authorization: 'secret-token',
    })

    expect(summary).toBe('present: Signature, Signature-Agent; missing: Signature-Input')
    expect(summary).not.toContain('secret')
    expect(summary).not.toContain('Authorization')
  })
})

describe('fetchOrCreateCrawlerSignatureHeaders', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset()
    vi.mocked(outputDebug).mockReset()
  })

  test('reuses an active Shopify CLI crawler signature for the store domain', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      storefrontCrawlerSignatures: {
        edges: [
          {
            node: crawlerSignature,
          },
        ],
      },
    })

    const headers = await fetchOrCreateCrawlerSignatureHeaders(adminSession)

    expect(headers).toEqual({
      Signature: 'signature-value',
      'Signature-Input': 'signature-input-value',
      'Signature-Agent': 'signature-agent-value',
    })
    expect(adminRequest).toHaveBeenCalledTimes(1)
    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('storefrontCrawlerSignatures'),
      adminSession,
      {
        first: 1,
        expired: false,
        cli: true,
        domain: 'store.myshopify.com',
      },
      'unstable',
    )
  })

  test('creates a Shopify CLI crawler signature when no reusable signature exists', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(emptyCrawlerSignaturesResponse)
      .mockResolvedValueOnce({
        storefrontCrawlerSignatureGenerate: {
          ...crawlerSignature,
          userErrors: [],
        },
      })

    const headers = await fetchOrCreateCrawlerSignatureHeaders(adminSession)

    expect(headers).toEqual({
      Signature: 'signature-value',
      'Signature-Input': 'signature-input-value',
      'Signature-Agent': 'signature-agent-value',
    })
    expect(adminRequest).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('storefrontCrawlerSignatureGenerate'),
      adminSession,
      {
        timeToLive: CRAWLER_SIGNATURE_TTL_SECONDS,
        name: CRAWLER_SIGNATURE_NAME,
        domainHost: 'store.myshopify.com',
        cli: true,
      },
      'unstable',
    )
  })

  test('queries and creates signatures for a custom domain', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(emptyCrawlerSignaturesResponse)
      .mockResolvedValueOnce({
        storefrontCrawlerSignatureGenerate: {
          ...crawlerSignature,
          domainHost: 'custom.example.com',
          userErrors: [],
        },
      })

    await fetchOrCreateCrawlerSignatureHeaders(adminSession, 'custom.example.com')

    expect(adminRequest).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('storefrontCrawlerSignatures'),
      adminSession,
      expect.objectContaining({domain: 'custom.example.com'}),
      'unstable',
    )
    expect(adminRequest).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('storefrontCrawlerSignatureGenerate'),
      adminSession,
      expect.objectContaining({domainHost: 'custom.example.com'}),
      'unstable',
    )
  })

  test('continues without crawler signature headers when the query fails to return a connection', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({storefrontCrawlerSignatures: null})

    await expect(fetchOrCreateCrawlerSignatureHeaders(adminSession)).resolves.toBeUndefined()
    expect(outputDebug).toHaveBeenCalledWith(
      expect.stringContaining('Could not obtain crawler signature headers; continuing without them.'),
    )
  })

  test('continues without crawler signature headers when generation returns user errors', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(emptyCrawlerSignaturesResponse)
      .mockResolvedValueOnce({
        storefrontCrawlerSignatureGenerate: {
          ...crawlerSignature,
          userErrors: [
            {
              field: ['domainHost'],
              message: 'Domain is not connected',
              code: 'INVALID',
            },
          ],
        },
      })

    await expect(fetchOrCreateCrawlerSignatureHeaders(adminSession)).resolves.toBeUndefined()
    expect(outputDebug).toHaveBeenCalledWith(
      expect.stringContaining('Could not obtain crawler signature headers; continuing without them.'),
    )
  })

  test('continues without crawler signature headers when generation does not return a signature', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce(emptyCrawlerSignaturesResponse).mockResolvedValueOnce({
      storefrontCrawlerSignatureGenerate: null,
    })

    await expect(fetchOrCreateCrawlerSignatureHeaders(adminSession)).resolves.toBeUndefined()
    expect(outputDebug).toHaveBeenCalledWith(
      expect.stringContaining('Could not obtain crawler signature headers; continuing without them.'),
    )
  })

  test('continues without crawler signature headers when generation omits a required header', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(emptyCrawlerSignaturesResponse)
      .mockResolvedValueOnce({
        storefrontCrawlerSignatureGenerate: {
          ...crawlerSignature,
          signatureInput: '',
          userErrors: [],
        },
      })

    await expect(fetchOrCreateCrawlerSignatureHeaders(adminSession)).resolves.toBeUndefined()
    expect(outputDebug).toHaveBeenCalledWith(
      expect.stringContaining('Could not obtain crawler signature headers; continuing without them.'),
    )
  })
})
