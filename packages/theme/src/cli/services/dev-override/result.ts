import {themePreviewJsonOutputSchema, type ThemePreviewResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export function renderThemePreviewResult(result: ThemePreviewResult, format: 'text' | 'json', updated: boolean): void {
  if (format === 'json') {
    outputResult(themePreviewJsonOutputSchema.encode(result))
    return
  }

  renderSuccess({
    body: [
      {
        list: {
          title: updated ? 'Preview updated' : 'Preview is ready',
          items: [{link: {url: result.url}}, `Preview ID: ${result.preview_identifier}`],
        },
      },
    ],
  })
}

export function renderThemePreviewOpenError(error: Error): void {
  const headline = 'Failed to open theme preview.'
  const body = error.stack ?? error.message
  renderWarning({headline, body})
}
