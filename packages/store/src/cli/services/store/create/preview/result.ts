import {createPreviewStoreJsonOutputSchema, type CreatePreviewStoreResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, type InlineToken, type TokenItem} from '@shopify/cli-kit/node/ui'

type CreatePreviewStoreOutputFormat = 'text' | 'json'

export function presentCreatePreviewStoreResult(
  result: CreatePreviewStoreResult,
  format: CreatePreviewStoreOutputFormat,
): void {
  if (format === 'json') {
    outputResult(createPreviewStoreJsonOutputSchema.encode(result))
    return
  }

  renderTextResult(result)
}

function tokenizeNextStep(nextStep: string): TokenItem<InlineToken> {
  return nextStep
    .split(/(`[^`]+`)/)
    .map((part) => (part.startsWith('`') && part.endsWith('`') ? {command: part.slice(1, -1)} : part))
}

function renderTextResult(result: CreatePreviewStoreResult): void {
  renderSuccess({
    // Design copy intentionally omits trailing punctuation.
    // eslint-disable-next-line @shopify/cli/banner-headline-format
    headline: 'Store created',
    customSections: [
      {
        body: result.message,
      },
      {
        title: 'Next steps',
        body: {
          list: {
            items: result.next_steps.map(tokenizeNextStep),
          },
        },
      },
    ],
  })
}
