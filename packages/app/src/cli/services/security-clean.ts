import {cleanAllResultsDirectories, cleanResultsDirectory} from './app-security-artifacts.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'

/** The results directories that were removed. */
export interface SecurityCleanResult {
  removed: string[]
}

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
