import {appSecurityRecordJsonOutputSchema, type AppSecurityRecordResult} from './types.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from '../app-security-commands.js'
import {countLabel} from '../app-security-format.js'
import {projectAppSecurityApp, projectAppSecurityPath} from '../app-security-json-output.js'
import {resultsKey} from '../app-security-selection.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {SecurityRecordOptions, SecurityRecordResult} from '../security-record.js'

/** Presents a recorded document as JSON, or in the terminal. */
export function renderSecurityRecordResult(
  result: SecurityRecordResult,
  options: SecurityRecordOptions,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appSecurityRecordJsonOutputSchema.encode(appSecurityRecordResult(result, options)))
    return
  }

  const commands = resolveAppSecurityCommands(options.selection, options.path)
  renderSuccess({
    headline: 'Agent findings recorded.',
    body: [
      `Recorded ${countLabel(result.checks, 'check')} and ${countLabel(result.findings, 'finding')} in`,
      {filePath: result.path},
    ],
    nextSteps: [['Run', {command: formatAppSecurityCommand(commands.review)}, 'to see the results.']],
  })
}

function appSecurityRecordResult(
  result: SecurityRecordResult,
  {selection}: SecurityRecordOptions,
): AppSecurityRecordResult {
  const {resultsDirectory} = appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection))
  return {
    status: 'success',
    app: projectAppSecurityApp(selection),
    resultsDirectory: projectAppSecurityPath(resultsDirectory),
    path: projectAppSecurityPath(result.path),
    checkCount: result.checks,
    findingCount: result.findings,
  }
}
