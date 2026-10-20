import {appSecurityDirectory} from '../app-security-artifacts.js'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {SecurityCleanResult} from '../security-clean.js'

/** Presents a clean result in the terminal. */
export function renderSecurityCleanResult(result: SecurityCleanResult, appDirectory: string): void {
  if (result.removed.length === 0) {
    renderInfo({
      headline: 'No app security check results to remove.',
      body: ['Nothing was found in', {filePath: appSecurityDirectory(appDirectory)}],
    })
  } else {
    renderSuccess({
      headline: 'App security check results removed.',
      body: {list: {items: result.removed.map((path) => ({filePath: path}))}},
    })
  }
}
