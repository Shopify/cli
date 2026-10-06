import {getAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import type {AutoUpgradeResult} from './types.js'

export function getAutoUpgradeStatus(): AutoUpgradeResult {
  return {enabled: getAutoUpgradeEnabled()}
}
