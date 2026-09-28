import {themeMetafieldsPullJsonOutputSchema, type ThemeMetafieldsPullResult} from './types.js'
import {outputDebug, outputResult} from '@shopify/cli-kit/node/output'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderThemeMetafieldsPullResult(
  result: ThemeMetafieldsPullResult,
  format: 'text' | 'json',
  silent = false,
): void {
  if (result.status === 'downloaded' && result.failedOwnerTypes.length > 0) {
    outputDebug(
      `Failed to fetch metafield definitions for the following owner types: ${result.failedOwnerTypes.join(', ')}`,
    )
  }

  if (silent) return

  if (format === 'json') {
    if (result.status === 'failed') {
      emitCommandEvent({type: 'diagnostic', level: 'error', message: 'Failed to fetch metafield definitions.'})
    }
    outputResult(themeMetafieldsPullJsonOutputSchema.encode(result))
  } else if (result.status === 'downloaded') {
    renderSuccess({body: 'Metafield definitions have been successfully downloaded.'})
  } else if (result.status === 'failed') {
    renderError({
      body: 'Failed to fetch metafield definitions.',
      nextSteps: [
        'Check your network connection and try again.',
        'Ensure you have the permission to fetch metafield definitions.',
      ],
      reference: [
        {
          link: {
            label: 'Metafield Definition API',
            url: 'https://shopify.dev/docs/api/admin-graphql/latest/queries/metafieldDefinition',
          },
        },
      ],
    })
  }
}
