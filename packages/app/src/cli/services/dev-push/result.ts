import {appDevPushJsonOutputSchema, DevPushResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export function renderDevPushResult(result: DevPushResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(appDevPushJsonOutputSchema.encode(result))
    return
  }

  for (const warning of result.warnings) {
    renderWarning({headline: warning.message})
  }
  renderSuccess({
    headline: 'Dev preview created.',
    body: `A snapshot of ${result.app.name} is active on ${result.storeDomain}.`,
    nextSteps: [
      [{link: {label: 'Open the app preview', url: result.previewUrl}}],
      ['Run', {command: 'shopify app dev clean'}, "to restore the app's released version."],
    ],
  })
}
