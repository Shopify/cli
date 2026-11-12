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

/** Explain how to persist a suppression that the automatic candidates could not select. */
function renderNotSavedSuppressions({notSaved}: RecordedSuppressions): void {
  renderWarning({
    headline: `${countLabel(notSaved.length, 'suppression')} couldn't be saved to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
    body: [
      "They're recorded in agent-findings.json, so they apply to these findings only, until the next record.",
      entriesByHandLine(notSaved),
    ]
      .filter((line) => line !== undefined)
      .join(' '),
    customSections: [
      {
        body: {
          list: {
            items: notSaved.map((suppression): TokenItem<InlineToken> => {
              const {checkId, location, problem} = suppression
              return [
                {filePath: location.line === undefined ? location.file : `${location.file}:${location.line}`},
                {subdued: `· ${checkId}`},
                `\nIt can't be saved because ${problem}.`,
                `\n${notSavedAdvice(suppression)}`,
              ]
            }),
          },
        },
      },
    ],
  })
}

type NotSavedSuppression = RecordedSuppressions['notSaved'][number]

/** "To keep them, add entries to shopify.app-security.json by hand.", unless every entry by hand would be invalid. */
function entriesByHandLine(notSaved: NotSavedSuppression[]): string | undefined {
  const keepableCount = notSaved.filter(({invalidFields}) => invalidFields === undefined).length
  if (keepableCount === 0) return undefined
  if (keepableCount === notSaved.length) {
    return `To keep them, add entries to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} by hand.`
  }
  return `To keep the ones that ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} can name, add entries to it by hand.`
}

function notSavedAdvice({checkId, withoutCode, invalidFields}: NotSavedSuppression): string {
  if (invalidFields?.includes('path')) {
    return `${APP_SECURITY_SUPPRESSIONS_FILE_NAME} can't name this path, so no entry can keep it. An entry for it by hand would make the file invalid too.`
  }
  if (invalidFields) {
    return `An entry for it by hand with the same values would make ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} invalid too.`
  }
  if (withoutCode) {
    return `The automatic code selectors did not select this finding alone. You can try a manual entry with a code that names it alone. An agent entry without code suppresses all ${countLabel(withoutCode.findingCount, 'agent finding')} of ${checkId} in that file. Omit code only if you intend to suppress all of these findings.`
  }
  return 'Give its entry a code that names it alone.'
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
    notSaved: notSaved.map((suppression) => {
      const {checkId, location, problem, invalidFields, withoutCode} = suppression
      return {
        checkId,
        location: {
          filePath: projectAppSecurityRelativePath(appDirectory, location.file),
          line: location.line ?? null,
        },
        message: problem,
        advice: notSavedAdvice(suppression),
        invalidFields: invalidFields ?? null,
        findingCountWithoutCode: withoutCode?.findingCount ?? null,
      }
    }),
  }
}
