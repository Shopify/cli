import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {checkStatusLabels, checksWithFindingsLabel, countLabel} from './app-security-format.js'
import {
  activeFindings,
  isAgentResultStale,
  isCheckPassed,
  isSuppressed,
  skippedFileCounts,
  summarizeCombinedChecks,
  type AgentCheckCatalogEntry,
  type AppSecurityScope,
  type CheckPrecedence,
  type CombinedCheck,
  type CombinedChecksSummary,
  type CombinedFinding,
  type DeterministicFindingsDocument,
  type FindingsDocument,
  type FindingsSource,
  type Severity,
  type SourceCheckResult,
  type StoredCheckStatus,
} from './app-security-engine/index.js'
import {reviewFailed, type SecurityReviewResult} from './security-review.js'
import {timeAgo} from '@shopify/cli-kit/common/string'
import {renderError, renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection, InlineToken, RenderAlertOptions, Token, TokenItem} from '@shopify/cli-kit/node/ui'

/**
 * The terminal view of `app security review` (§9.4). The view-model functions return data; only
 * `renderSecurityReview` touches the terminal, so tests assert on data plus a few rendered checks.
 */

export interface SecurityReviewPresenterInput {
  result: SecurityReviewResult
  verbose: boolean
  now: Date
  commands: AppSecurityCommands
  /** The checks the coding agent can run: which checks only it can settle, and how its results combine. */
  agentChecks: AgentCheckCatalogEntry[]
}

type SecurityReviewAlertType = 'info' | 'success' | 'warning' | 'error'

interface SecurityReviewAlert {
  type: SecurityReviewAlertType
  options: RenderAlertOptions
}

interface ChecksWithFindingsRow {
  severity: string
  id: string
  /** Active findings per source, non-zero sources only: "1 deterministic, 2 agent". */
  counts: string
}

/** A results file is either missing, or present with its relative age and engine version. */
type ResultsFileRow =
  | {name: string; updated: 'not found'; engine?: never}
  | {name: string; updated: string; engine: string}

/** The summary closes with the next steps, or with the Blocking line when the review fails. */
type SecurityReviewSummaryClosing =
  | {nextSteps: TokenItem<InlineToken>[]; blocking?: never}
  | {nextSteps?: never; blocking: string}

/** The summary box, always rendered last. Sections are undefined or empty when they don't apply. */
type SecurityReviewSummary = {
  type: SecurityReviewAlertType
  headline: string
  filterLine?: string
  checksWithFindings: ChecksWithFindingsRow[]
  otherChecks: string[]
  /** How many checks have no authoritative result until the coding agent runs them, and why. */
  agentResultsPending?: string
  /** Present when a filtered check shows both sources because its agent result is stale. */
  staleAgentResults?: string
  coverage?: string
  /** The latest scan's directories and scope, and the scope the agent reported. Empty without any results file. */
  scopeLines: string[]
  scopeNote?: string
  resultsFiles: {directory: string; rows: ResultsFileRow[]}
} & SecurityReviewSummaryClosing

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
/**
 * The status words of the checks without findings. An executed check has passed unless it is a prefer-agent check
 * with only a deterministic result.
 */
const CHECK_STATUS_LABEL: Record<StoredCheckStatus, string> = {
  executed: 'passed',
  not_applicable: 'not applicable',
  unresolved: 'unresolved',
}
/**
 * A prefer-agent check that only a deterministic result backs: the rule found nothing, but the agent result that is
 * meant to decide the check is missing. Calling that a pass would read as a clean result for a question the rule
 * can't answer. A `union` check's deterministic pass stands on its own, so it keeps the pass.
 */
const NO_DETERMINISTIC_FINDINGS_LABEL = 'no deterministic findings'
/** One source's own status: it executed, whatever the combined check's findings say. */
const SOURCE_STATUS_LABEL: Record<StoredCheckStatus, string> = {
  executed: 'executed',
  not_applicable: 'not applicable',
  unresolved: 'unresolved',
}
const SOURCE_ORDER: FindingsSource[] = ['deterministic', 'agent']
const FILE_NAMES: Record<FindingsSource, string> = {
  deterministic: 'deterministic-findings.json',
  agent: 'agent-findings.json',
}
const CONCISE_REASONING_LINES = 3
const SCOPE_DIFFERS_NOTE = 'Agent findings were recorded for a different scope than the latest scan.'
/** Marks a check whose `prefer-agent` agent result is older than the deterministic one, so both sources count. */
const STALE_AGENT_RESULT_MARKER = 'agent result stale'
const STALE_AGENT_RESULT_EXPLANATION = 'The agent result is older than the deterministic result, so both are shown.'

const renderers: Record<SecurityReviewAlertType, (options: RenderAlertOptions) => void> = {
  info: renderInfo,
  success: renderSuccess,
  warning: renderWarning,
  error: renderError,
}

export function renderSecurityReview(input: SecurityReviewPresenterInput): void {
  for (const alert of buildSecurityReviewAlerts(input)) {
    renderers[alert.type](alert.options)
  }
}

/**
 * Every box in order: unresolved checks, checks without results, passed checks, one per check with findings, then the
 * summary.
 */
export function buildSecurityReviewAlerts(input: SecurityReviewPresenterInput): SecurityReviewAlert[] {
  const {checks} = input.result
  const awaitingAgentIds = checksAwaitingAgentResult(input).ids
  const unresolved = checks.filter((check) => check.status === 'unresolved' && activeFindings(check).length === 0)
  const passedOrNotApplicable = checks.filter(
    (check) => check.status !== 'unresolved' && activeFindings(check).length === 0,
  )
  const withFindings = checks.filter((check) => activeFindings(check).length > 0)
  const missing = missingCheckIdsToShow(input.result)

  return [
    ...(unresolved.length > 0 ? [unresolvedChecksAlert(unresolved, input.verbose)] : []),
    ...(missing.length > 0 ? [missingChecksAlert(missing)] : []),
    ...(passedOrNotApplicable.length > 0
      ? [passedChecksAlert(passedOrNotApplicable, awaitingAgentIds, input.verbose)]
      : []),
    ...withFindings.map((check) => checkWithFindingsAlert(check, input.verbose, input.now)),
    summaryAlert(buildSecurityReviewSummary(input)),
  ]
}

export function buildSecurityReviewSummary(input: SecurityReviewPresenterInput): SecurityReviewSummary {
  const {result} = input
  const anyFilePresent = result.sources.deterministic !== null || result.sources.agent !== null
  const summary = summarizeCombinedChecks(result.checks)
  const deterministic = result.sources.deterministic?.document
  const staleChecks = result.checks.filter(isAgentResultStale).length
  const awaitingAgent = checksAwaitingAgentResult(input)

  const failed = reviewFailed(result)

  return {
    type: summaryAlertType(result.checks, summary, anyFilePresent, awaitingAgent.total, failed),
    headline: summaryHeadline(result.checks, summary, anyFilePresent),
    ...(result.filter && anyFilePresent
      ? {filterLine: `Showing ${result.checks.length} of ${result.allChecks.length} checks (--check-id).`}
      : {}),
    checksWithFindings: result.checks.filter((check) => activeFindings(check).length > 0).map(checksWithFindingsRow),
    otherChecks: otherChecksLines(result.checks, awaitingAgent.ids, summary),
    ...(anyFilePresent && awaitingAgent.total > 0 ? {agentResultsPending: agentResultsPendingLine(awaitingAgent)} : {}),
    ...(staleChecks > 0 ? {staleAgentResults: staleAgentResultsLine(staleChecks)} : {}),
    ...(deterministic ? {coverage: coverageLine(deterministic)} : {}),
    scopeLines: scopeLines(result.sources),
    ...(result.scopeDiffers ? {scopeNote: SCOPE_DIFFERS_NOTE} : {}),
    resultsFiles: {
      directory: result.resultsDirectory,
      rows: SOURCE_ORDER.map((source) => resultsFileRow(source, result.sources[source]?.document, input.now)),
    },
    ...(failed
      ? {blocking: failedGatesLine(result)}
      : {
          nextSteps: nextSteps(result, summary, anyFilePresent, staleChecks, awaitingAgent.total, input.commands),
        }),
  }
}

function blockingLine({blockedChecks, level}: SecurityReviewResult['blocking']): string {
  return `${countLabel(blockedChecks, 'check')} at or above ${level} (--blocking ${level}).`
}

/**
 * The warning that `review --sarif` renders after the log, which goes to stdout alone. Code scanning closes the alerts
 * missing from an upload as fixed, and a check without results reads as passing, so a log without results, or with
 * unresolved checks or checks without results, closes alerts that may still be open. A failed `--blocking` or `--fail-on-unresolved` is named
 * too, since the log doesn't explain the exit code. Undefined when neither applies.
 */
function securityReviewSarifWarning(result: SecurityReviewResult): RenderAlertOptions | undefined {
  const headline = sarifUploadNote(result)
  const blocking = reviewFailed(result) ? failedGatesLine(result) : undefined
  if (headline === undefined && blocking === undefined) return undefined
  return {
    ...(headline === undefined ? {} : {headline}),
    ...(blocking === undefined ? {} : {customSections: [{title: 'Blocking', body: blocking}]}),
  }
}

export function renderSecurityReviewSarifWarning(result: SecurityReviewResult): void {
  const warning = securityReviewSarifWarning(result)
  if (warning) renderWarning(warning)
}

/**
 * Why the log could close open alerts, and, without `--fail-on-unresolved`, how to fail the review on it. With the flag,
 * either reason fails the review, so the Blocking section names the flag instead.
 */
function sarifUploadNote(result: SecurityReviewResult): string | undefined {
  const risk = sarifUploadRisk(result)
  if (risk === undefined || result.failOnUnresolved) return risk
  return `${risk} Pass --fail-on-unresolved to exit with code 1 while a check is unresolved or has no result.`
}

function sarifUploadRisk(result: SecurityReviewResult): string | undefined {
  if (result.sources.deterministic === null && result.sources.agent === null) {
    return 'The SARIF log has no results, so code scanning would close every open alert as fixed.'
  }
  // With findings or not, as the log's invocation counts them.
  const unresolved = result.checks.filter((check) => check.status === 'unresolved').length
  const missing = result.missingCheckIds.length
  if (unresolved + missing === 0) return undefined
  const counts = [
    unresolved > 0 ? countLabel(unresolved, 'unresolved check') : '',
    missing > 0 ? `${countLabel(missing, 'check')} without results` : '',
  ]
    .filter(Boolean)
    .join(' and ')
  const them = unresolved + missing === 1 ? 'its' : 'their'
  return `The SARIF log has ${counts}, so code scanning could close ${them} open alerts as fixed. Have your coding agent record its findings before you upload it.`
}

/** One sentence per failed gate, `--blocking` then `--fail-on-unresolved`. */
function failedGatesLine(result: SecurityReviewResult): string {
  const unsettled = [
    result.unresolvedChecks > 0 ? `${countLabel(result.unresolvedChecks, 'check')} unresolved` : '',
    result.missingCheckIds.length > 0 ? `${countLabel(result.missingCheckIds.length, 'check')} without results` : '',
  ].filter(Boolean)
  return [
    result.blocking.blockedChecks > 0 ? blockingLine(result.blocking) : '',
    result.failOnUnresolved && unsettled.length > 0 ? `${unsettled.join(' and ')} (--fail-on-unresolved).` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function staleAgentResultsLine(staleChecks: number): string {
  const verb = staleChecks === 1 ? 'shows' : 'show'
  return `${countLabel(staleChecks, 'check')} ${verb} both sources because the agent results are older than the deterministic results.`
}

/** The checks that still need the agent, split by why, so the summary can say what the agent adds. */
interface ChecksAwaitingAgentResult {
  /** The checks themselves, so the boxes label the same checks the summary counts. */
  ids: Set<string>
  /** Checks that neither results file has, such as one that only the agent implements. */
  withoutResults: number
  /** Checks whose deterministic result is unresolved: the deterministic rule couldn't decide them. */
  unresolved: number
  /** Prefer-agent checks with only a deterministic result, which an agent result replaces. */
  deterministicResultOnly: number
  total: number
}

/**
 * Finds the filtered agent checks that aren't settled until the coding agent runs them. An agent result settles a
 * check, and so does a deterministic `not_applicable` result, which reports that the capability the check needs is
 * absent. A deterministic `executed` result settles a `union` check, where a pass from either source counts, but not
 * a `prefer-agent` check, where the agent result is meant to decide. The stored results decide, not the catalog's
 * implementations, so a check that an older scan didn't run, or a check whose rule doesn't support the app's
 * framework, still counts.
 */
function checksAwaitingAgentResult({result, agentChecks}: SecurityReviewPresenterInput): ChecksAwaitingAgentResult {
  const checksById = new Map(result.allChecks.map((check) => [check.id, check]))
  const selected = result.filter ? new Set(result.filter.checkIds) : null
  const awaiting = {ids: new Set<string>(), withoutResults: 0, unresolved: 0, deterministicResultOnly: 0}
  for (const {id, precedence} of agentChecks) {
    if (selected && !selected.has(id)) continue
    const reason = awaitingReason(checksById.get(id), precedence)
    if (reason === undefined) continue
    awaiting[reason] += 1
    awaiting.ids.add(id)
  }
  return {...awaiting, total: awaiting.ids.size}
}

function awaitingReason(
  check: CombinedCheck | undefined,
  precedence: CheckPrecedence,
): 'withoutResults' | 'unresolved' | 'deterministicResultOnly' | undefined {
  if (check === undefined) return 'withoutResults'
  const {deterministic, agent} = check.by_source
  if (agent !== null || deterministic === null) return undefined
  if (deterministic.status === 'unresolved') return 'unresolved'
  if (deterministic.status === 'executed' && precedence === 'prefer-agent') return 'deterministicResultOnly'
  return undefined
}

function agentResultsPendingLine({
  withoutResults,
  unresolved,
  deterministicResultOnly,
  total,
}: ChecksAwaitingAgentResult): string {
  const reasons = [
    withoutResults > 0 ? `${withoutResults} without results` : undefined,
    unresolved > 0 ? `${unresolved} unresolved` : undefined,
    deterministicResultOnly > 0
      ? `${deterministicResultOnly} where an agent result takes precedence over the deterministic one`
      : undefined,
  ].filter((reason) => reason !== undefined)
  const reasonList = reasons
    .map((reason, index) => (index > 0 && index === reasons.length - 1 ? `and ${reason}` : reason))
    .join(', ')
  return `${countLabel(total, 'check')} ${total === 1 ? 'needs' : 'need'} your coding agent: ${reasonList}.`
}

/**
 * Mirrors `securityAlertType` in security-output.ts, with `info` for the no-results state. Checks that still need
 * the agent keep the neutral style too: a green box would read as a clean result. A failed review is at least a
 * warning, so the box never looks like a pass when the exit code is 1.
 */
function summaryAlertType(
  checks: CombinedCheck[],
  summary: CombinedChecksSummary,
  anyFilePresent: boolean,
  awaitingAgent: number,
  failed: boolean,
): SecurityReviewAlertType {
  if (checks.some((check) => check.severity === 'high' && activeFindings(check).length > 0)) return 'error'
  if (failed || summary.withFindings > 0 || summary.unresolved > 0) return 'warning'
  if (!anyFilePresent) return 'info'
  if (awaitingAgent > 0) return 'info'
  return 'success'
}

function summaryHeadline(checks: CombinedCheck[], summary: CombinedChecksSummary, anyFilePresent: boolean): string {
  if (!anyFilePresent) return 'No app security check results to review.'
  if (summary.withFindings === 0) return `No findings in ${countLabel(checks.length, 'check')}.`
  const unresolved = summary.unresolved > 0 ? ` ${countLabel(summary.unresolved, 'check')} unresolved.` : ''
  return `${checksWithFindingsLabel(summary)}.${unresolved}`
}

function checksWithFindingsRow(check: CombinedCheck): ChecksWithFindingsRow {
  return {severity: SEVERITY_LABEL[check.severity], id: check.id, counts: activeCountsBySource(check)}
}

function activeCountsBySource(check: CombinedCheck): string {
  const active = activeFindings(check)
  return SOURCE_ORDER.map((source) => [source, active.filter((finding) => finding.source === source).length] as const)
    .filter(([, total]) => total > 0)
    .map(([source, total]) => `${total} ${source}`)
    .join(', ')
}

function otherChecksLines(
  checks: CombinedCheck[],
  awaitingAgentIds: Set<string>,
  summary: CombinedChecksSummary,
): string[] {
  const withoutDeterministicFindings = checks.filter(
    (check) => isCheckPassed(check) && awaitingAgentIds.has(check.id),
  ).length
  return [joinParts(checkStatusLabels(summary, withoutDeterministicFindings)), dispositionCounts(summary)].filter(
    (line) => line !== '',
  )
}

function dispositionCounts(counts: {suppressed: number; superseded: number}): string {
  return joinParts([
    counts.suppressed > 0 ? `${countLabel(counts.suppressed, 'finding')} suppressed` : undefined,
    counts.superseded > 0 ? `${countLabel(counts.superseded, 'finding')} superseded` : undefined,
  ])
}

/** The suppressed and superseded counts of one check, or an empty string when it has neither. */
function checkDispositionCounts(check: CombinedCheck): string {
  return dispositionCounts(summarizeCombinedChecks([check]))
}

function joinParts(parts: (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined).join(' · ')
}

function coverageLine(document: DeterministicFindingsDocument): string {
  const skipped = document.coverage.files_skipped
  const {too_large: tooLarge, unreadable} = skippedFileCounts(skipped)
  const reasons = [
    tooLarge > 0 ? `${tooLarge} too large` : undefined,
    unreadable > 0 ? `${unreadable} unreadable` : undefined,
  ].filter((reason) => reason !== undefined)
  const skippedText = skipped.length === 0 ? 'none skipped' : `${skipped.length} skipped (${reasons.join(', ')})`

  const unsupported = document.detection.languages.filter((language) => language.support === 'unsupported')
  const languagesText =
    unsupported.length === 0
      ? ''
      : ` Unsupported ${unsupported.length === 1 ? 'language' : 'languages'}: ${unsupported
          .map((language) => `${language.name} (${countLabel(language.files.length, 'file')})`)
          .join(', ')}.`

  return `Deterministic coverage: ${countLabel(document.coverage.files_scanned, 'file')} scanned, ${skippedText}.${languagesText}`
}

function formatScope(scope: AppSecurityScope): string {
  const flags = [
    ...scope.include_dirs.map((includeDir) => `--include-dir ${includeDir}`),
    ...scope.excludes.map((excludePattern) => `--exclude ${excludePattern}`),
    ...(scope.no_git_ignore ? ['--no-git-ignore'] : []),
  ]
  return flags.length === 0 ? 'none' : flags.join(' ')
}

function scopeLines({deterministic, agent}: SecurityReviewResult['sources']): string[] {
  return [
    ...(deterministic
      ? [
          `Scan directories: ${deterministic.document.coverage.scan_directories.map(({directory}) => directory).join(', ')}`,
          `Scan scope: ${formatScope(deterministic.document.coverage.scope)}`,
        ]
      : []),
    ...(agent ? [`Scope reported by the agent: ${formatScope(agent.document.scope)}`] : []),
  ]
}

function resultsFileRow(source: FindingsSource, document: FindingsDocument | undefined, now: Date): ResultsFileRow {
  const name = FILE_NAMES[source]
  if (!document) return {name, updated: 'not found'}
  return {
    name,
    updated: formatAge(document.generated_at, now),
    engine: document.engine.version,
  }
}

function formatAge(timestamp: string, now: Date): string {
  const time = Date.parse(timestamp)
  if (Number.isNaN(time)) return 'unknown'
  return timeAgo(new Date(time), now)
}

function nextSteps(
  result: SecurityReviewResult,
  summary: CombinedChecksSummary,
  anyFilePresent: boolean,
  staleChecks: number,
  awaitingAgentChecks: number,
  commands: AppSecurityCommands,
): TokenItem<InlineToken>[] {
  const checkCommand = {command: formatAppSecurityCommand(commands.scan)}
  if (!anyFilePresent) return [['Run', checkCommand, 'or have your coding agent run it.']]

  const steps: TokenItem<InlineToken>[] = []
  // `check` rewrites deterministic-findings.json but never touches agent-findings.json; only the agent does.
  if (summary.withFindings > 0) {
    const fixStep: InlineToken[] = ['Fix the issues, then run', checkCommand, 'again.']
    if (result.sources.agent === null || staleChecks > 0) {
      // The stale step below says how to refresh the agent findings.
      steps.push(fixStep)
    } else {
      steps.push([...fixStep, 'To refresh agent findings, have your agent run the command and record its findings.'])
    }
  }
  // The stale step has the agent run its checks again, so it stands in for the step for checks without an agent result.
  if (staleChecks > 0) {
    steps.push([
      'Agent results are older than the deterministic results. Have your coding agent run',
      checkCommand,
      'and record its findings again to refresh them.',
    ])
  } else if (awaitingAgentChecks > 0) {
    steps.push([
      `To run ${countLabel(awaitingAgentChecks, 'check')} with no agent result yet, have your coding agent follow`,
      {command: formatAppSecurityCommand(commands.instructions)},
      {char: '.'},
    ])
  }
  return steps
}

function summaryAlert(summary: SecurityReviewSummary): SecurityReviewAlert {
  const sections: AlertCustomSection[] = []
  if (summary.filterLine) sections.push({body: {subdued: summary.filterLine}})
  if (summary.checksWithFindings.length > 0) {
    sections.push({
      title: 'Checks with findings',
      body: {
        tabularData: summary.checksWithFindings.map((row) => [row.severity, row.id, row.counts]),
        firstColumnSubdued: true,
      },
    })
  }
  if (summary.otherChecks.length > 0) sections.push({title: 'Other checks', body: summary.otherChecks.join('\n')})
  if (summary.agentResultsPending) sections.push({body: summary.agentResultsPending})
  if (summary.staleAgentResults) sections.push({body: summary.staleAgentResults})
  if (summary.coverage) sections.push({body: {subdued: summary.coverage}})
  if (summary.scopeLines.length > 0) sections.push({body: {subdued: summary.scopeLines.join('\n')}})
  if (summary.scopeNote) sections.push({body: summary.scopeNote})
  sections.push({
    title: `Results files in ${summary.resultsFiles.directory}`,
    body: {
      tabularData: [
        ['', {subdued: 'Updated'}, {subdued: 'Engine'}],
        ...summary.resultsFiles.rows.map(resultsFileCells),
      ],
    },
  })
  if (summary.blocking === undefined) {
    // Nothing left to suggest when both result files are present and no check has findings or is stale.
    if (summary.nextSteps.length > 0) sections.push({title: 'Next steps', body: {list: {items: summary.nextSteps}}})
  } else {
    sections.push({title: 'Blocking', body: summary.blocking})
  }

  return {type: summary.type, options: {headline: summary.headline, customSections: sections}}
}

function resultsFileCells(row: ResultsFileRow): InlineToken[] {
  if (row.engine === undefined) return [row.name, {subdued: row.updated}]
  return [row.name, row.updated, row.engine]
}

/**
 * With `--fail-on-unresolved`, the checks without results that fail the review, so the output names what is left to
 * record. None without any results file: there every check is missing, and the summary says that no results exist.
 */
function missingCheckIdsToShow(result: SecurityReviewResult): string[] {
  const anyFilePresent = result.sources.deterministic !== null || result.sources.agent !== null
  return result.failOnUnresolved && anyFilePresent ? result.missingCheckIds : []
}

function missingChecksAlert(checkIds: string[]): SecurityReviewAlert {
  return {
    type: 'warning',
    options: {
      headline: `${countLabel(checkIds.length, 'check')} without results.`,
      body: 'Neither results file has these checks.',
      customSections: [{body: {list: {items: checkIds}}}],
    },
  }
}

/**
 * Unresolved checks with no active findings. With `--verbose`, each check's suppressed and superseded findings
 * follow it in full, prefixed by the check ID, as in the passed checks box.
 */
function unresolvedChecksAlert(checks: CombinedCheck[], verbose: boolean): SecurityReviewAlert {
  return {
    type: 'warning',
    options: {
      headline: `${countLabel(checks.length, 'check')} unresolved.`,
      customSections: checks.flatMap((check) => [
        {
          title: `${check.id} · ${check.title}`,
          body: {tabularData: sourceStatusRows(check, {withDispositions: true}), firstColumnSubdued: true},
        },
        ...(verbose ? check.findings.map((finding) => findingSection(finding, verbose, `${check.id} · `)) : []),
      ]),
    },
  }
}

/**
 * Passed and not applicable checks in one table. These checks have no active findings, so with
 * `--verbose` their suppressed and superseded findings are listed here in full, prefixed by the check ID.
 */
function passedChecksAlert(
  checks: CombinedCheck[],
  awaitingAgentIds: Set<string>,
  verbose: boolean,
): SecurityReviewAlert {
  const executed = checks.filter(isCheckPassed)
  const withoutDeterministicFindings = executed.filter((check) => awaitingAgentIds.has(check.id)).length
  const passed = executed.length - withoutDeterministicFindings
  const notApplicable = checks.length - executed.length
  const headline = [
    passed > 0 ? `${countLabel(passed, 'check')} passed.` : undefined,
    withoutDeterministicFindings > 0
      ? `${countLabel(withoutDeterministicFindings, 'check')} with no deterministic findings.`
      : undefined,
    notApplicable > 0 ? `${countLabel(notApplicable, 'check')} not applicable.` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(' ')

  return {
    type: 'info',
    options: {
      headline,
      customSections: [
        {
          // Two columns: with the longest check IDs, a third column for the counts would overflow the box.
          body: {
            tabularData: checks.map((check) => passedCheckRow(check, awaitingAgentIds)),
          },
        },
        ...(verbose
          ? checks.flatMap((check) =>
              check.findings.map((finding) => findingSection(finding, verbose, `${check.id} · `)),
            )
          : []),
      ],
    },
  }
}

/** The check ID, then its outcome with the suppressed and superseded counts and the stale marker when they apply. */
function passedCheckRow(check: CombinedCheck, awaitingAgentIds: Set<string>): InlineToken[] {
  const counts = checkDispositionCounts(check)
  return [
    check.id,
    joinParts([
      checkOutcomeLabel(check, awaitingAgentIds),
      counts === '' ? undefined : counts,
      isAgentResultStale(check) ? STALE_AGENT_RESULT_MARKER : undefined,
    ]),
  ]
}

/**
 * Only an agent result, or a deterministic result that stands on its own, makes an executed check a pass: a check
 * that still needs the agent is labelled with the deterministic findings alone.
 */
function checkOutcomeLabel(check: CombinedCheck, awaitingAgentIds: Set<string>): string {
  if (check.status !== 'executed') return CHECK_STATUS_LABEL[check.status]
  return awaitingAgentIds.has(check.id) ? NO_DETERMINISTIC_FINDINGS_LABEL : CHECK_STATUS_LABEL.executed
}

/**
 * The statuses are shown when the sources disagree, and always for a stale check: there both results count,
 * so each comes with its age and a line says why.
 */
function checkWithFindingsAlert(check: CombinedCheck, verbose: boolean, now: Date): SecurityReviewAlert {
  const counts = checkDispositionCounts(check)
  const findings = verbose ? check.findings : activeFindings(check)

  return {
    type: check.severity === 'high' ? 'error' : 'warning',
    options: {
      headline: `${SEVERITY_LABEL[check.severity]} · ${check.id} · ${check.title}`,
      ...(counts === '' ? {} : {body: {subdued: counts}}),
      ...(check.docs_url ? {link: {label: `${check.id} on shopify.dev`, url: check.docs_url}} : {}),
      customSections: [
        ...sourceStatusSections(check, now),
        ...findings.map((finding) => findingSection(finding, verbose)),
      ],
    },
  }
}

/**
 * For a stale check, both sources' statuses with their ages, then the explanation. Otherwise the statuses alone
 * when the sources disagree, and nothing when they agree.
 */
function sourceStatusSections(check: CombinedCheck, now: Date): AlertCustomSection[] {
  if (isAgentResultStale(check)) {
    const rows = SOURCE_ORDER.flatMap((source) => {
      const result = check.by_source[source]
      return result ? [[source, sourceStatusText(result), formatAge(result.generated_at, now)]] : []
    })
    return [{body: {tabularData: rows, firstColumnSubdued: true}}, {body: {subdued: STALE_AGENT_RESULT_EXPLANATION}}]
  }
  const {deterministic, agent} = check.by_source
  const sourcesDiffer = deterministic !== null && agent !== null && deterministic.status !== agent.status
  if (sourcesDiffer) {
    return [{body: {tabularData: sourceStatusRows(check, {withDispositions: false}), firstColumnSubdued: true}}]
  }
  return []
}

/**
 * One row per present source: its status and, for unresolved and not applicable results, the reason. A stale
 * agent result carries the stale marker.
 */
function sourceStatusRows(check: CombinedCheck, options: {withDispositions: boolean}): InlineToken[][] {
  const stale = isAgentResultStale(check)
  const rows = SOURCE_ORDER.flatMap((source) => {
    const result = check.by_source[source]
    if (!result) return []
    const marker = stale && source === 'agent' ? STALE_AGENT_RESULT_MARKER : undefined
    return [[source, joinParts([sourceStatusText(result), marker])]]
  })
  const counts = options.withDispositions ? checkDispositionCounts(check) : ''
  return counts === '' ? rows : [...rows, ['findings', counts]]
}

function sourceStatusText(result: SourceCheckResult): string {
  const status = SOURCE_STATUS_LABEL[result.status]
  return result.reason ? `${status} — ${result.reason.message}` : status
}

function findingSection(finding: CombinedFinding, verbose: boolean, titlePrefix = ''): AlertCustomSection {
  const disposition = finding.disposition === 'active' ? '' : ` (${finding.disposition})`
  const details: Token[] = [finding.message]
  if (finding.snippet) details.push({subdued: `\nCode: ${finding.snippet}`})
  if (finding.source === 'deterministic') {
    if (finding.fix) details.push({subdued: `\nFix: ${finding.fix.description}`})
    const guide = finding.fix?.guide
    if (guide) details.push({subdued: `\nGuide: ${guide}`})
  } else {
    if (finding.confidence) details.push({subdued: `\nConfidence: ${finding.confidence}`})
    if (finding.reasoning)
      details.push({subdued: `\nReasoning: ${verbose ? finding.reasoning : conciseReasoning(finding.reasoning)}`})
  }
  if (verbose) {
    details.push(
      ...finding.evidence.map((evidence) => ({
        subdued: `\nEvidence: ${formatLocation(evidence.location)}${evidence.quote ? ` — ${evidence.quote}` : ''}`,
      })),
    )
    // Only the agent suppresses findings (`isSuppressed`); a hand-edited deterministic suppression stays silent.
    if (isSuppressed(finding, finding.source) && finding.suppression) {
      details.push({subdued: `\nSuppressed: ${finding.suppression.justification}`})
    }
  }
  return {title: `${titlePrefix}${finding.source} · ${formatLocation(finding.location)}${disposition}`, body: details}
}

function conciseReasoning(reasoning: string): string {
  const lines = reasoning.split('\n')
  if (lines.length <= CONCISE_REASONING_LINES) return reasoning
  return `${lines.slice(0, CONCISE_REASONING_LINES).join('\n')}…`
}

function formatLocation(location: CombinedFinding['location']): string {
  return location.line === undefined ? location.file : `${location.file}:${location.line}`
}
