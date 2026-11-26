import {appSecurityCleanJsonOutputSchema, type AppSecurityCleanResult} from './types.js'
import {appSecurityDirectory} from '../app-security-artifacts.js'
import {projectAppSecurityApp, projectAppSecurityPath} from '../app-security/result.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {SecurityCleanOptions, SecurityCleanResult} from '../security-clean.js'

/** Presents a clean result as JSON, or in the terminal. */
export function renderSecurityCleanResult(
  result: SecurityCleanResult,
  options: SecurityCleanOptions,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appSecurityCleanJsonOutputSchema.encode(appSecurityCleanResult(result, options)))
    return
  }

  if (result.removed.length === 0) {
    const appDirectory = options.all ? options.appDirectory : options.selection.appDirectory
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

function appSecurityCleanResult(result: SecurityCleanResult, options: SecurityCleanOptions): AppSecurityCleanResult {
  return {
    status: 'success',
    changed: result.removed.length > 0,
    app: options.all
      ? {directory: projectAppSecurityPath(options.appDirectory)}
      : projectAppSecurityApp(options.selection),
    resultsDirectories: result.removed.map(projectAppSecurityPath),
  }
}
