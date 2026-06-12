import {type CreatePreviewStoreResult} from './index.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

type CreatePreviewStoreOutputFormat = 'text' | 'json'

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
    next_steps: result.nextSteps,
  }
}

function renderTextResult(result: CreatePreviewStoreResult): void {
  renderSuccess({
    headline: 'Preview store created.',
    body: result.message,
    customSections: [
      {
        title: 'Store',
        body: {
          tabularData: [
            ['Name', result.store.name],
            ['Domain', result.store.subdomain],
            ['Access URL', result.store.accessUrl],
            ['Claim URL', result.store.claimUrl],
            ...(result.store.requestedCountry
              ? ([['Requested country', result.store.requestedCountry]] as string[][])
              : []),
          ],
          firstColumnSubdued: true,
        },
      },
    ],
    nextSteps: [
      [
        'Open ',
        {link: {label: result.store.accessUrl, url: result.store.accessUrl}},
        ' to view and access your preview store.',
      ],
      [
        'Claim ',
        {link: {label: result.store.claimUrl, url: result.store.claimUrl}},
        ' to save your preview store and continue editing later.',
      ],
      [
        'Use ',
        {command: `shopify store execute --store ${result.store.subdomain}`},
        ' to add products, collections, pages, and more.',
      ],
      [
        'Use ',
        {command: 'shopify theme pull'},
        ' and ',
        {command: 'shopify theme push'},
        ' to edit your store design.',
      ],
    ],
  })
}
