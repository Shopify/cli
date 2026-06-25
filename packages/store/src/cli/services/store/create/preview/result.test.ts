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
    'Your Shopify store "Lavender Candles" is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
  store: {
    id: '123',
    name: 'Lavender Candles',
    subdomain: 'x12y45z.myshopify.com',
    country: 'US',
    storefrontUrl: 'https://x12y45z.myshopify.com/?foo=bar',
  },
}

describe('preview store create result presenter', () => {
  test('writes JSON output with the storefront URL', () => {
    writeCreatePreviewStoreResult(result, 'json')

    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          status: 'success',
          message:
            'Your Shopify store "Lavender Candles" is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
          store: {
            id: '123',
            name: 'Lavender Candles',
            subdomain: 'x12y45z.myshopify.com',
            country: 'US',
            storefrontUrl: 'https://x12y45z.myshopify.com/?foo=bar',
          },
          next_steps: [
            'Open your store (https://x12y45z.myshopify.com/?foo=bar) to preview the storefront.',
            'Use `shopify store execute --store x12y45z.myshopify.com` to add products, collections, pages, and more.',
            'Use `shopify theme pull --store x12y45z.myshopify.com` and `shopify theme push --store x12y45z.myshopify.com` to edit your store design.',
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
            body: 'Your Shopify store "Lavender Candles" is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
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
                    'Use ',
                    {command: 'shopify store execute --store x12y45z.myshopify.com'},
                    ' to add products, collections, pages, and more.',
                  ],
                  [
                    'Use ',
                    {command: 'shopify theme pull --store x12y45z.myshopify.com'},
                    ' and ',
                    {command: 'shopify theme push --store x12y45z.myshopify.com'},
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
