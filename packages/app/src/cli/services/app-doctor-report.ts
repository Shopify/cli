import {quoteShellArgument, shellForPlatform} from './app-doctor-commands.js'
import {relativePath} from '@shopify/cli-kit/node/path'
import {renderInfo, renderTable, renderWarning} from '@shopify/cli-kit/node/ui'
import type {
  AppDoctorStatusCheck,
  AppDoctorStatusFinding,
  AppDoctorStatusModeOutcome,
  AppDoctorStatusResult,
  AppDoctorStatusScope,
} from './app-doctor-status-json.js'
import type {InlineToken, ListToken, TokenItem} from '@shopify/cli-kit/node/ui'

const BASIS_SENTENCE = 'No scan was performed; results reflect the tree as it was when each result was recorded.'

const plural = (count: number, noun: string): string => `${count} ${count === 1 ? noun : `${noun}s`}`

const words = (identifier: string): string => identifier.replace(/_/g, ' ')

/** Timestamps are stored to the millisecond; the day is what a reader needs to tell results apart. */
const day = (producedAt: string): string => producedAt.slice(0, 'YYYY-MM-DD'.length)

type ResultMode = 'static' | 'agent'
const MODES: ResultMode[] = ['static', 'agent']

/** Grouped counts lead with what needs attention and end with what was never run. */
const OUTCOME_ORDER: AppDoctorStatusModeOutcome['outcome'][] = [
  'findings',
  'unresolved',
  'unsupported_framework',
  'clean',
  'not_applicable',
  'not_run',
]

/** Outcomes worth naming check by check; the rest are only counted. */
const ENUMERATED_OUTCOMES = new Set<AppDoctorStatusModeOutcome['outcome']>(['findings', 'unresolved'])

function describeCheckOutcome(mode: Exclude<AppDoctorStatusModeOutcome, {outcome: 'not_run'}>): string {
  const outcome = mode.outcome === 'findings' ? plural(mode.finding_count, 'finding') : words(mode.outcome)
  const reason = mode.reason === undefined ? '' : `, ${words(mode.reason.code)}`
  return `${outcome}${reason} (${day(mode.produced_at)})`
}

/**
 * One line per mode summarising every check's outcome by count, followed by
 * the checks that need attention, so a scope with dozens of clean checks
 * stays readable while nothing is hidden.
 */
function describeMode(mode: ResultMode, checks: ReadonlyArray<AppDoctorStatusCheck>): string {
  const outcomes = checks.map((check) => check[mode])
  const recorded = outcomes.flatMap((outcome) => (outcome.outcome === 'not_run' ? [] : [outcome.produced_at]))
  if (recorded.length === 0) return `${mode}: not run`
  const counts = OUTCOME_ORDER.flatMap((outcome) => {
    const count = outcomes.filter((entry) => entry.outcome === outcome).length
    return count === 0 ? [] : [`${count} ${words(outcome)}`]
  })
  // ISO-8601 UTC timestamps sort lexically, so the maximum string is the latest.
  const latest = recorded.reduce((left, right) => (left > right ? left : right))
  // "latest" only means something when the mode's results were recorded at different times.
  const recordedAt = new Set(recorded).size === 1 ? `recorded ${day(latest)}` : `latest recorded ${day(latest)}`
  const summary = [...counts, recordedAt].join(' · ')
  const attention = checks.flatMap((check) => {
    const outcome = check[mode]
    if (outcome.outcome === 'not_run' || !ENUMERATED_OUTCOMES.has(outcome.outcome)) return []
    return [`  ${check.check_id}: ${describeCheckOutcome(outcome)}`]
  })
  return [`${mode}: ${summary}`, ...attention].join('\n')
}

/** Only scopes with results are listed, so "nothing recorded" means no check has a result in any scope. */
const hasRecordedChecks = (result: AppDoctorStatusResult): boolean =>
  result.scopes.some((scope) => scope.checks.length > 0)

/**
 * Scopes are named relative to the app root (`.` for the root itself, `../shared` for one outside it).
 * A directory with no local spelling is already the recorded reference and is shown as-is.
 */
function scopeLabel(scope: AppDoctorStatusScope, appRoot: string): string {
  if (!scope.directory_resolved) return scope.directory
  return relativePath(appRoot, scope.directory) || '.'
}

function scopeList(scope: AppDoctorStatusScope, appRoot: string): ListToken {
  return {
    list: {
      title: scopeLabel(scope, appRoot),
      items: MODES.map((mode) => describeMode(mode, scope.checks)),
    },
  }
}

/** `path` is where the file would be on this machine; `file` is the recorded evidence reference, shown when there is no local spelling. */
const describeLocation = (location: AppDoctorStatusFinding['location']): string =>
  [location.path ?? location.file, location.line, location.column].filter((part) => part !== undefined).join(':')

function describeCoverage(coverage: AppDoctorStatusResult['coverage']): string {
  if (coverage.static_result_count === 0) return 'no static results'
  if (coverage.complete) return 'complete'
  return `incomplete (${plural(coverage.gaps.length, 'gap')})`
}

function describeScore(score: AppDoctorStatusResult['score']): string {
  if (score.status === 'graded') return `${score.total} (${score.grade})`
  return `withheld (${words(score.reason)})`
}

function nextSteps(result: AppDoctorStatusResult): TokenItem<InlineToken>[] {
  const shell = shellForPlatform()
  const quote = (value: string) => quoteShellArgument(value, shell)
  const target = `--path ${quote(result.app_root)} --config ${quote(result.configuration.name)}`
  const steps: TokenItem<InlineToken>[] = []
  if (!hasRecordedChecks(result)) {
    steps.push(['Get the coding-agent review workflow with', {command: `shopify app doctor instructions ${target}`}])
  }
  if (result.coverage.static_result_count === 0) {
    steps.push([
      'Static scanning is separate and optional; run it with',
      {command: `shopify app doctor --path ${quote(result.app_root)}`},
    ])
  }
  return steps
}

function renderUnmatchedSuppressions(unmatched: AppDoctorStatusResult['suppressions']['unmatched']): void {
  if (unmatched.length === 0) return
  const verbs = unmatched.length === 1 ? 'matches no stored finding and has' : 'match no stored finding and have'
  renderWarning({
    body: `${plural(unmatched.length, 'suppression')} ${verbs} no effect: ${unmatched
      .map((suppression) => suppression.id)
      .join(', ')}`,
  })
}

function renderDiagnostics(diagnostics: AppDoctorStatusResult['diagnostics']): void {
  if (diagnostics.length === 0) return
  renderWarning({
    headline: 'App Doctor skipped files it could not use while reading the result store.',
    body: [
      {
        list: {
          items: diagnostics.map(
            (diagnostic) =>
              `${diagnostic.code}: ${diagnostic.message}${diagnostic.path === undefined ? '' : ` (${diagnostic.path})`}`,
          ),
        },
      },
    ],
  })
}

function renderEmpty(result: AppDoctorStatusResult): void {
  renderInfo({
    headline: `No App Doctor results are stored for ${result.configuration.name}`,
    body: [`Looked for stored results in ${result.store.directory}. ${BASIS_SENTENCE}`],
    nextSteps: nextSteps(result),
  })
}

function renderFindingsTable(
  findings: ReadonlyArray<AppDoctorStatusFinding>,
  scopes: ReadonlyArray<AppDoctorStatusScope>,
  appRoot: string,
) {
  if (findings.length === 0) return
  const scopesByIdentity = new Map(scopes.map((scope) => [scope.scope_identity, scope]))
  // Every finding belongs to a listed scope; the identity is a defensive fallback only.
  const scopeColumn = (scopeIdentity: string): string => {
    const scope = scopesByIdentity.get(scopeIdentity)
    return scope === undefined ? scopeIdentity : scopeLabel(scope, appRoot)
  }
  renderTable({
    rows: findings.map((finding) => ({
      severity: finding.severity,
      code: finding.code,
      scope: scopeColumn(finding.scope_identity),
      location: describeLocation(finding.location),
      source: finding.sources.join('+'),
    })),
    columns: {
      severity: {header: 'SEVERITY'},
      code: {header: 'CODE'},
      scope: {header: 'SCOPE'},
      location: {header: 'LOCATION'},
      source: {header: 'SOURCE'},
    },
  })
}

/**
 * Text presenter for `shopify app doctor status`. Renders the same data the
 * JSON output carries: every scope and check outcome, every unsuppressed
 * finding, and the score. Suppressed findings are counted, not listed.
 */
export function renderAppDoctorStatusReport(result: AppDoctorStatusResult): void {
  renderDiagnostics(result.diagnostics)
  renderUnmatchedSuppressions(result.suppressions.unmatched)
  if (!hasRecordedChecks(result)) {
    renderEmpty(result)
    return
  }
  renderInfo({
    headline: `App Doctor status for ${result.configuration.name}`,
    body: [BASIS_SENTENCE, ...result.scopes.map((scope) => scopeList(scope, result.app_root))],
  })
  const shown = result.findings.filter((finding) => !finding.suppressed)
  renderFindingsTable(shown, result.scopes, result.app_root)
  // One string with line breaks: cli-kit joins separate body strings with spaces.
  renderInfo({
    body: [
      `Findings shown: ${shown.length}`,
      `Suppressed: ${result.suppressions.suppressed_findings}`,
      `Static coverage: ${describeCoverage(result.coverage)}`,
      `Score: ${describeScore(result.score)}`,
    ].join('\n'),
    nextSteps: nextSteps(result),
  })
}
