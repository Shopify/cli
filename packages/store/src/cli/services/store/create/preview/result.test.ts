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
  message:
    'Your Shopify store is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
  store: {
    id: '123',
    name: 'Lavender Candles',
    subdomain: 'x12y45z.myshopify.com',
    country: 'US',
    storefrontUrl: 'https://x12y45z.myshopify.com/?foo=bar',
    saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
  },
}

describe('preview store create result presenter', () => {
  test('writes JSON output with the storefront and save URLs', () => {
    writeCreatePreviewStoreResult(result, 'json')

    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          status: 'success',
          message:
            'Your Shopify store is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
          store: {
            id: '123',
            name: 'Lavender Candles',
            subdomain: 'x12y45z.myshopify.com',
            country: 'US',
            storefrontUrl: 'https://x12y45z.myshopify.com/?foo=bar',
            saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
          },
          next_steps: [
            'Open your store (https://x12y45z.myshopify.com/?foo=bar) to preview the storefront.',
            'Create an account (https://admin.shopify.com/store-transfer/accept/claim-token) for free to save progress.',
            'Use `shopify store execute` to add products, collections, pages, and more.',
            'Use `shopify theme pull` and `shopify theme push` to edit your store design.',
          ],
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
        headline: 'Store created',
        customSections: [
          {
            body: {
              tabularData: [
                ['Name', 'Lavender Candles'],
                ['Domain', 'x12y45z.myshopify.com'],
              ],
              firstColumnSubdued: true,
            },
          },
          {
            body: 'Your Shopify store is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
          },
          {
            title: 'Next steps',
            body: {
              list: {
                items: [
                  [
                    'Open ',
                    {
                      link: {
                        label: 'your store',
                        url: 'https://x12y45z.myshopify.com/?foo=bar',
                      },
                    },
                    ' to preview the storefront.',
                  ],
                  [
                    'Create ',
                    {
                      link: {
                        label: 'an account',
                        url: 'https://admin.shopify.com/store-transfer/accept/claim-token',
                      },
                    },
                    ' for free to save progress.',
                  ],
                  ['Use ', {command: 'shopify store execute'}, ' to add products, collections, pages, and more.'],
                  [
                    'Use ',
                    {command: 'shopify theme pull'},
                    ' and ',
                    {command: 'shopify theme push'},
                    ' to edit your store design.',
                  ],
                ],
              },
            },
          },
        ],
      }),
    )
  })
})
