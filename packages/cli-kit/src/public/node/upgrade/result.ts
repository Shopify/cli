import {upgradeJsonOutputSchema, type UpgradeResult} from './types.js'
import {outputResult} from '../output.js'
import {renderSuccess} from '../ui.js'

/**
 * Presents the upgrade result without changing progress or package-manager output.
 *
 * @param result - The completed upgrade outcome.
 * @param format - The output format selected by the caller.
 */
export function presentUpgradeResult(result: UpgradeResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(upgradeJsonOutputSchema.encode(result))
  } else if (result.status === 'upgraded') {
    renderSuccess({
      headline: 'Shopify CLI upgraded.',
      body: `You're now on version ${result.version}.`,
    })
  }
}
