import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {checkStatusLabels, checksWithFindingsLabel, countLabel} from './app-security-format.js'
import {
  activeFindings,
  isAgentResultStale,
  isCheckPassed,
  isSuppressed,
  skippedFileCounts,
  summarizeCombinedChecks,
  type AppSecurityScope,
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
import {timeAgo} from '@shopify/cli-kit/common/string'
import {renderError, renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection, InlineToken, RenderAlertOptions, Token, TokenItem} from '@shopify/cli-kit/node/ui'
import type {SecurityReviewResult} from './security-review.js'

/**
 * The terminal view of `app security review` (§9.4). The view-model functions return data; only
 * `renderSecurityReview` touches the terminal, so tests assert on data plus a few rendered checks.
 */

export interface SecurityReviewPresenterInput {
  result: SecurityReviewResult
  verbose: boolean
  now: Date
  commands: AppSecurityCommands
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

/** The summary closes with the next steps, or with the Blocking line when `--blocking` is breached. */
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
  /** Present when a filtered check shows both sources because its agent result is stale. */
  staleAgentResults?: string
  coverage?: string
  /** The latest scan's directories and scope, and the scope the agent reported. Empty without any results file. */
  scopeLines: string[]
  scopeNote?: string
  resultsFiles: {directory: string; rows: ResultsFileRow[]}
} & SecurityReviewSummaryClosing

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
/** A combined check's status: an executed check with no active findings has passed. */
const CHECK_STATUS_LABEL: Record<StoredCheckStatus, string> = {
  executed: 'passed',
  not_applicable: 'not applicable',
  unresolved: 'unresolved',
}
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

/** Every box in order: unresolved checks, passed checks, one per check with findings, then the summary. */
export function buildSecurityReviewAlerts(input: SecurityReviewPresenterInput): SecurityReviewAlert[] {
  const {checks} = input.result
  const unresolved = checks.filter((check) => check.status === 'unresolved' && activeFindings(check).length === 0)
  const passedOrNotApplicable = checks.filter(
    (check) => check.status !== 'unresolved' && activeFindings(check).length === 0,
  )
  const withFindings = checks.filter((check) => activeFindings(check).length > 0)

  return [
    ...(unresolved.length > 0 ? [unresolvedChecksAlert(unresolved, input.verbose)] : []),
    ...(passedOrNotApplicable.length > 0 ? [passedChecksAlert(passedOrNotApplicable, input.verbose)] : []),
    ...withFindings.map((check) => checkWithFindingsAlert(check, input.verbose, input.now)),
    summaryAlert(buildSecurityReviewSummary(input)),
  ]
}

export function buildSecurityReviewSummary(input: SecurityReviewPresenterInput): SecurityReviewSummary {
  const {result} = input
  const anyFilePresent = result.sources.deterministic !== null || result.sources.agent !== null
  const summary = summarizeCombinedChecks(result.checks)
  const deterministic = result.sources.deterministic?.document
  const breached = result.blocking.blockedChecks > 0
  const staleChecks = result.checks.filter(isAgentResultStale).length

  return {
    type: summaryAlertType(result.checks, summary, anyFilePresent),
    headline: summaryHeadline(result.checks, summary, anyFilePresent),
    ...(result.filter && anyFilePresent
      ? {filterLine: `Showing ${result.checks.length} of ${result.allChecks.length} checks (--check-id).`}
      : {}),
    checksWithFindings: result.checks.filter((check) => activeFindings(check).length > 0).map(checksWithFindingsRow),
    otherChecks: otherChecksLines(summary),
    ...(staleChecks > 0 ? {staleAgentResults: staleAgentResultsLine(staleChecks)} : {}),
    ...(deterministic ? {coverage: coverageLine(deterministic)} : {}),
    scopeLines: scopeLines(result.sources),
    ...(result.scopeDiffers ? {scopeNote: SCOPE_DIFFERS_NOTE} : {}),
    resultsFiles: {
      directory: result.resultsDirectory,
      rows: SOURCE_ORDER.map((source) => resultsFileRow(source, result.sources[source]?.document, input.now)),
    },
    ...(breached
      ? {
          blocking: `${countLabel(result.blocking.blockedChecks, 'check')} at or above ${result.blocking.level} (--blocking ${
            result.blocking.level
          }).`,
        }
      : {nextSteps: nextSteps(result, summary, anyFilePresent, staleChecks, input.commands)}),
  }
}

function staleAgentResultsLine(staleChecks: number): string {
  const verb = staleChecks === 1 ? 'shows' : 'show'
  return `${countLabel(staleChecks, 'check')} ${verb} both sources because the agent results are older than the deterministic results.`
}

/** Mirrors `securityAlertType` in security-output.ts, with `info` for the no-results state. */
function summaryAlertType(
  checks: CombinedCheck[],
  summary: CombinedChecksSummary,
  anyFilePresent: boolean,
): SecurityReviewAlertType {
  if (!anyFilePresent) return 'info'
  if (checks.some((check) => check.severity === 'high' && activeFindings(check).length > 0)) return 'error'
  if (summary.withFindings > 0 || summary.unresolved > 0) return 'warning'
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

function otherChecksLines(summary: CombinedChecksSummary): string[] {
  return [joinParts(checkStatusLabels(summary)), dispositionCounts(summary)].filter((line) => line !== '')
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
  commands: AppSecurityCommands,
): TokenItem<InlineToken>[] {
  const checkCommand = {command: formatAppSecurityCommand(commands.scan)}
  if (!anyFilePresent) return [['Run', checkCommand, 'or have your coding agent run it.']]

  const steps: TokenItem<InlineToken>[] = []
  // `check` rewrites deterministic-findings.json but never touches agent-findings.json; only the agent does.
  if (summary.withFindings > 0) {
    const fixStep: InlineToken[] = ['Fix the issues, then run', checkCommand, 'again.']
    if (result.sources.agent === null) {
      steps.push(fixStep, 'For a deeper review, have your agent run the same command and record its findings.')
    } else if (staleChecks > 0) {
      // The stale step below says how to refresh the agent findings.
      steps.push(fixStep)
    } else {
      steps.push([...fixStep, 'To refresh agent findings, have your agent run the command and record its findings.'])
    }
  }
  // A stale check needs agent-findings.json, so this step never meets the deeper-review one.
  if (staleChecks > 0) {
    steps.push([
      'Agent results are older than the deterministic results. Have your coding agent run',
      checkCommand,
      'and record its findings again to refresh them.',
    ])
  } else if (summary.withFindings === 0 && result.sources.agent === null) {
    steps.push(['For a deeper review, have your coding agent run', checkCommand, {char: '.'}])
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
function passedChecksAlert(checks: CombinedCheck[], verbose: boolean): SecurityReviewAlert {
  const passed = checks.filter(isCheckPassed).length
  const notApplicable = checks.length - passed
  const headline = [
    passed > 0 ? `${countLabel(passed, 'check')} passed.` : undefined,
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
            tabularData: checks.map(passedCheckRow),
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

/** The check ID, then its status with the suppressed and superseded counts and the stale marker when they apply. */
function passedCheckRow(check: CombinedCheck): InlineToken[] {
  const counts = checkDispositionCounts(check)
  return [
    check.id,
    joinParts([
      CHECK_STATUS_LABEL[check.status],
      counts === '' ? undefined : counts,
      isAgentResultStale(check) ? STALE_AGENT_RESULT_MARKER : undefined,
    ]),
  ]
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
