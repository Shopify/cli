import {type ThemePreviewResult} from './types.js'
import {encodeThemePreviewResult} from './codec.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'

export function renderThemePreviewResult(result: ThemePreviewResult, format: 'text' | 'json', updated: boolean): void {
  if (format === 'json') {
    // Preserve preview's existing stderr output and command-event routing.
    outputInfo(encodeThemePreviewResult(result))
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

export function renderThemePreviewOpenError(error: Error, format: 'text' | 'json'): void {
  const headline = 'Failed to open theme preview.'
  const body = error.stack ?? error.message
  if (format === 'json') {
    emitCommandEvent({type: 'diagnostic', level: 'warning', message: `${headline}\n${body}`})
  } else {
    renderWarning({headline, body})
  }
}
