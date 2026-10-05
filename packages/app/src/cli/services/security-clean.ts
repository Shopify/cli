import {appSecurityDirectory, cleanAllResultsDirectories, cleanResultsDirectory} from './app-security-artifacts.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {SecurityCleanResult} from './security-clean-json.js'

/** `all` removes every results directory under the app directory; otherwise only the selection's. */
type SecurityCleanOptions = {all: true; appDirectory: string} | {all: false; selection: AppSecuritySelection}

export interface SecurityCleanDependencies {
  cleanResults(appDirectory: string, resultsKey: string): Promise<string[]>
  cleanAllResults(appDirectory: string): Promise<string[]>
}

const defaultDependencies: SecurityCleanDependencies = {
  cleanResults: cleanResultsDirectory,
  cleanAllResults: cleanAllResultsDirectories,
}

/** Removes app security check results directories without asking. Prints nothing. */
export default async function securityClean(
  options: SecurityCleanOptions,
  dependencies: SecurityCleanDependencies = defaultDependencies,
): Promise<SecurityCleanResult> {
  const removed = options.all
    ? await dependencies.cleanAllResults(options.appDirectory)
    : await dependencies.cleanResults(options.selection.appDirectory, resultsKey(options.selection))
  return {removed}
}

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
