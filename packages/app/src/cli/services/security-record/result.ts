import {appSecurityRecordJsonOutputSchema, type AppSecurityRecordResult} from './types.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from '../app-security-commands.js'
import {countLabel} from '../app-security-format.js'
import {projectAppSecurityApp, projectAppSecurityPath} from '../app-security/result.js'
import {resultsKey} from '../app-security-selection.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {SecurityRecordOptions, SecurityRecordResult} from '../security-record.js'

/** Presents a recorded document as JSON, or in the terminal, after a warning on stderr when it has no code excerpts. */
export function renderSecurityRecordResult(
  result: SecurityRecordResult,
  options: SecurityRecordOptions,
  format: 'json' | 'text',
): void {
  if (result.codeExcerptsOmitted) {
    renderWarning({
      headline:
        'agent-findings.json was written without code excerpts, because with them it would be larger than 5 MB.',
      body: 'Record fewer or shorter findings to keep them.',
    })
  }
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
