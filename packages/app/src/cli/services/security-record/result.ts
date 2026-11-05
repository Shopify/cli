import {appSecurityRecordJsonOutputSchema, type AppSecurityRecordResult} from './types.js'
import {APP_SECURITY_SUPPRESSIONS_FILE_NAME, appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from '../app-security-commands.js'
import {countLabel} from '../app-security-format.js'
import {
  projectAppSecurityApp,
  projectAppSecurityPath,
  projectAppSecurityRelativePath,
  projectAppSecuritySavedSuppression,
} from '../app-security/result.js'
import {resultsKey} from '../app-security-selection.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {InlineToken, TokenItem} from '@shopify/cli-kit/node/ui'
import type {RecordedSuppressions, SecurityRecordOptions, SecurityRecordResult} from '../security-record.js'

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
  const suppressions = result.suppressions
  const savedCount = suppressions?.saved.length ?? 0
  renderSuccess({
    headline: 'Agent findings recorded.',
    body: [
      `Recorded ${countLabel(result.checks, 'check')} and ${countLabel(result.findings, 'finding')} in`,
      {filePath: result.path},
      ...(suppressions ? suppressionLines(suppressions) : []),
    ],
    nextSteps: [
      ['Run', {command: formatAppSecurityCommand(commands.review)}, 'to see the results.'],
      ...(savedCount > 0 ? [`Review and commit ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`] : []),
    ],
  })
  if (suppressions && suppressions.notSaved.length > 0) renderNotSavedSuppressions(suppressions)
}

/** "Saved 2 suppressions to shopify.app-security.json.", and how many were already there. */
function suppressionLines({saved, alreadySaved}: RecordedSuppressions): string[] {
  return [
    ...(saved.length > 0
      ? [`\nSaved ${countLabel(saved.length, 'suppression')} to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`]
      : []),
    ...(alreadySaved > 0
      ? [
          `\n${countLabel(alreadySaved, 'suppression')} ${alreadySaved === 1 ? 'was' : 'were'} already in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
        ]
      : []),
  ]
}

/**
 * Each suppression that no entry could name alone, so it applies to this run's findings only, with the entry to add by
 * hand: one with a code that names the finding alone, only when such a code exists, or else one without code.
 */
function renderNotSavedSuppressions({notSaved}: RecordedSuppressions): void {
  renderWarning({
    headline: `${countLabel(notSaved.length, 'suppression')} couldn't be saved to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
    body: `They're recorded in agent-findings.json, so they apply to these findings only, until the next record. To keep them, add entries to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} by hand.`,
    customSections: [
      {
        body: {
          list: {
            items: notSaved.map(
              ({checkId, location, problem, withoutCode}): TokenItem<InlineToken> => [
                {filePath: location.line === undefined ? location.file : `${location.file}:${location.line}`},
                {subdued: `· ${checkId}`},
                `\nIt can't be saved because ${problem}.`,
                withoutCode
                  ? `\nNo code from its lines, evidence or message names it alone. An agent entry without code suppresses all ${countLabel(withoutCode.findingCount, 'agent finding')} of ${checkId} in that file. To keep only this one suppressed, change the code so that the findings differ.`
                  : '\nGive its entry a code that names it alone.',
              ],
            ),
          },
        },
      },
    ],
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
    suppressions: result.suppressions ? projectRecordedSuppressions(result.suppressions, selection.appDirectory) : null,
  }
}

function projectRecordedSuppressions(
  {path, saved, alreadySaved, notSaved}: RecordedSuppressions,
  appDirectory: string,
): NonNullable<AppSecurityRecordResult['suppressions']> {
  return {
    filePath: projectAppSecurityPath(path),
    entries: saved.map((savedSuppression) => projectAppSecuritySavedSuppression(appDirectory, savedSuppression)),
    alreadySavedCount: alreadySaved,
    notSaved: notSaved.map(({checkId, location, problem}) => ({
      checkId,
      location: {
        filePath: projectAppSecurityRelativePath(appDirectory, location.file),
        line: location.line ?? null,
      },
      message: problem,
    })),
  }
}
