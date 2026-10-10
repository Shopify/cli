import {getAutoUpgradeEnabled, setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import type {AutoUpgradeResult} from './types.js'

export function getAutoUpgradeStatus(): AutoUpgradeResult {
  return {enabled: getAutoUpgradeEnabled()}
}

export function configureAutoUpgrade(enabled: boolean): AutoUpgradeResult {
  setAutoUpgradeEnabled(enabled)
  return {enabled}
}
