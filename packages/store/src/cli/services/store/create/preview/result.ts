import {type CreatePreviewStoreResult} from './index.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, type InlineToken, type TokenItem} from '@shopify/cli-kit/node/ui'

type CreatePreviewStoreOutputFormat = 'text' | 'json'
interface PreviewStoreNextStep {
  json: string
  text: TokenItem<InlineToken>
}

export function writeCreatePreviewStoreResult(
  result: CreatePreviewStoreResult,
  format: CreatePreviewStoreOutputFormat,
): void {
  if (format === 'json') {
    outputResult(JSON.stringify(serializeAsJson(result), null, 2))
    return
  }

  renderTextResult(result)
}

function serializeAsJson(result: CreatePreviewStoreResult) {
  return {
    status: result.status,
    message: result.message,
    store: result.store,
    next_steps: previewStoreNextSteps(result).map((step) => step.json),
  }
}

function previewStoreNextSteps(result: CreatePreviewStoreResult): PreviewStoreNextStep[] {
  return [
    {
      json: `Open your store (${result.store.storefrontUrl}) to preview the storefront.`,
      text: ['Open ', {link: {label: 'your store', url: result.store.storefrontUrl}}, ' to preview the storefront.'],
    },
    {
      json: `Create an account (${result.store.saveUrl}) for free to save progress.`,
      text: ['Create ', {link: {label: 'an account', url: result.store.saveUrl}}, ' for free to save progress.'],
    },
    {
      json: 'Use `shopify store execute` to add products, collections, pages, and more.',
      text: ['Use ', {command: 'shopify store execute'}, ' to add products, collections, pages, and more.'],
    },
    {
      json: 'Use `shopify theme pull` and `shopify theme push` to edit your store design.',
      text: [
        'Use ',
        {command: 'shopify theme pull'},
        ' and ',
        {command: 'shopify theme push'},
        ' to edit your store design.',
      ],
    },
  ]
}

function renderTextResult(result: CreatePreviewStoreResult): void {
  renderSuccess({
    // Design copy intentionally omits trailing punctuation.
    // eslint-disable-next-line @shopify/cli/banner-headline-format
    headline: 'Store created',
    customSections: [
      {
        body: {
          tabularData: [
            ['Name', result.store.name],
            ['Domain', result.store.subdomain],
          ],
          firstColumnSubdued: true,
        },
      },
      {
        body: result.message,
      },
      {
        title: 'Next steps',
        body: {
          list: {
            items: previewStoreNextSteps(result).map((step) => step.text),
          },
        },
      },
    ],
  })
}
