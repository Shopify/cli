import {writeCreatePreviewStoreResult} from './result.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/output', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/output')>('@shopify/cli-kit/node/output')
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/ui')>('@shopify/cli-kit/node/ui')
  return {...actual, renderSuccess: vi.fn()}
})

const result = {
  status: 'success' as const,
  message: 'Your preview store is ready.',
  store: {
    id: '123',
    name: 'Lavender Candles',
    subdomain: 'x12y45z.myshopify.com',
    accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
    claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    requestedCountry: 'US',
  },
  nextSteps: [
    'Open https://app.shopify.com/auth/preview-store?token=access-token to view and access your preview store.',
    'Claim https://admin.shopify.com/store-transfer/accept/claim-token to save your preview store and continue editing later.',
    'Use shopify store execute --store x12y45z.myshopify.com to add products, collections, pages, and more.',
    'Use shopify theme pull and shopify theme push to edit your store design.',
  ],
}

describe('preview store create result presenter', () => {
  test('writes JSON output with the returned access URL', () => {
    writeCreatePreviewStoreResult(result, 'json')

    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          status: 'success',
          message: 'Your preview store is ready.',
          store: {
            id: '123',
            name: 'Lavender Candles',
            subdomain: 'x12y45z.myshopify.com',
            accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
            claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
            requestedCountry: 'US',
          },
          next_steps: result.nextSteps,
        },
        null,
        2,
      ),
    )
  })

  test('renders text output with store details and next steps', () => {
    writeCreatePreviewStoreResult(result, 'text')

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Preview store created.',
        body: 'Your preview store is ready.',
        customSections: [
          {
            title: 'Store',
            body: {
              tabularData: [
                ['Name', 'Lavender Candles'],
                ['Domain', 'x12y45z.myshopify.com'],
                ['Access URL', 'https://app.shopify.com/auth/preview-store?token=access-token'],
                ['Claim URL', 'https://admin.shopify.com/store-transfer/accept/claim-token'],
                ['Requested country', 'US'],
              ],
              firstColumnSubdued: true,
            },
          },
        ],
        nextSteps: expect.arrayContaining([
          [
            'Open ',
            {
              link: {
                label: 'https://app.shopify.com/auth/preview-store?token=access-token',
                url: 'https://app.shopify.com/auth/preview-store?token=access-token',
              },
            },
            ' to view and access your preview store.',
          ],
          [
            'Claim ',
            {
              link: {
                label: 'https://admin.shopify.com/store-transfer/accept/claim-token',
                url: 'https://admin.shopify.com/store-transfer/accept/claim-token',
              },
            },
            ' to save your preview store and continue editing later.',
          ],
          [
            'Use ',
            {command: 'shopify store execute --store x12y45z.myshopify.com'},
            ' to add products, collections, pages, and more.',
          ],
        ]),
      }),
    )
  })
})
