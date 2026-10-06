import {autoUpgradeJsonOutputSchema, type AutoUpgradeResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function presentAutoUpgradeResult(result: AutoUpgradeResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(autoUpgradeJsonOutputSchema.encode({enabled: result.enabled}))
    return
  }

  renderInfo({
    body: result.enabled
      ? 'Auto-upgrade on. Shopify CLI will update automatically after each command.'
      : "Auto-upgrade off. You'll need to run `shopify upgrade` to update manually.",
  })
}
