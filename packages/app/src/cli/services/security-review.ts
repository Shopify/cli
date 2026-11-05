import {APP_SECURITY_SUPPRESSIONS_FILE_NAME, appSecurityArtifactPaths} from './app-security-artifacts.js'
import {resolveAppSecurityCommands, type AppSecurityCommands} from './app-security-commands.js'
import {
  resolveAppSecuritySelection,
  resultsKey,
  type AppSecuritySelection,
  type AppSecuritySelectionOptions,
} from './app-security-selection.js'
import {loadAppSecurityResults, type AppSecurityResults} from './app-security-results.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {
  parseSuppressionFlags,
  planSuppression,
  saveAppSecuritySuppressions,
  suppressionConfiguration,
  type SavedSuppression,
  type SuppressionChange,
  type SuppressionDecision,
  type SuppressionTarget,
} from './app-security-suppressions.js'
import {
  activeFindings,
  type CombinedCheck,
  type CombinedFinding,
  type SuppressionEntryResult,
} from './app-security-engine/index.js'
import {blockedCheckCount, type AppSecurityBlockingLevel} from './app-security-api.js'
import {sha256} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizePath} from '@shopify/cli-kit/node/path'
import {isDeepStrictEqual} from 'node:util'

interface SecurityReviewOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig?: boolean
  /** Exact check IDs from `--check-id`; empty means every check. */
  checkIds: string[]
  blocking: AppSecurityBlockingLevel
  /** `--suppress` and the flags that go with it. Absent without `--suppress`. */
  suppress?: SecurityReviewSuppressOptions
}

/** The flags of `review --suppress`, as typed. */
export interface SecurityReviewSuppressOptions {
  findingNumber: number
  /** `false-positive` or `accepted-risk`. */
  kind: string | undefined
  reason: string | undefined
  /** `--results-digest`: the digest that the numbers were read with. */
  resultsDigest: string | undefined
  /** `--include-superseded`: also suppress the finding's superseded deterministic companions. */
  includeSuperseded: boolean
}

/** The reviewed results: the loaded sources, the checks after `--check-id`, and the blocking outcome. */
export interface SecurityReviewResult {
  resultsDirectory: string
  sources: AppSecurityResults['sources']
  /** Every combined check, before `--check-id`. */
  allChecks: CombinedCheck[]
  /** The combined checks after `--check-id`, in canonical order. */
  checks: CombinedCheck[]
  filter: {checkIds: string[]} | null
  /** The agent recorded its findings for a different scope than the latest scan. False unless both results exist. */
  scopeDiffers: boolean
  /** One result per entry of shopify.app-security.json, in file order, whatever `--check-id` selects. */
  suppressions: SuppressionEntryResult[]
  /** The number of each finding of `allChecks` (`numberFindings`), whatever `--check-id` and `--verbose`. */
  findingNumbers: ReadonlyMap<CombinedFinding, number>
  /** A digest of the findings that the numbers name, or null when no results file exists. */
  resultsDigest: string | null
  blocking: {
    level: AppSecurityBlockingLevel
    /** Filtered checks with an active finding at or above the level. Zero for `none`. */
    blockedChecks: number
  }
}

/**
 * What `securityReview` returns: the selected app, its reviewed results, and the commands to run next. With
 * `--suppress`, the results are reviewed again after the save, so they show the finding as suppressed.
 */
export interface ReviewedAppSecurityResults {
  selection: AppSecuritySelection
  result: SecurityReviewResult
  commands: AppSecurityCommands
  /** What `--suppress` saved. Absent without `--suppress`. */
  savedSuppressions?: SavedReviewSuppressions
}

/** The entries of shopify.app-security.json that `--suppress` added or extended. */
export interface SavedReviewSuppressions {
  /** The absolute path of shopify.app-security.json. */
  path: string
  /** Each saved entry with the number of the finding it was saved for, the finding first, then its companions. */
  saved: (SavedSuppression & {findingNumber: number})[]
  /**
   * The numbers of the finding's companions that weren't suppressed, because `--include-superseded` wasn't passed:
   * superseded deterministic findings that `check --blocking`, which reads no agent results, still counts.
   */
  companionNumbers: number[]
}

/** A finding with its number: its position, from 1, among the findings of every check, in the order `review` lists them. */
interface NumberedFinding {
  number: number
  check: CombinedCheck
  finding: CombinedFinding
}

const RESULTS_DIGEST_LENGTH = 12

export interface SecurityReviewDependencies {
  resolveSelection(options: AppSecuritySelectionOptions): Promise<AppSecuritySelection>
  loadResults(selection: AppSecuritySelection, path: string): Promise<AppSecurityResults>
  recordMetadata(fields: AppSecurityMetadata): Promise<void>
}

const defaultDependencies: SecurityReviewDependencies = {
  resolveSelection: resolveAppSecuritySelection,
  loadResults: loadAppSecurityResults,
  recordMetadata: recordAppSecurityMetadata,
}

/**
 * Applies `--check-id` and `--blocking` to the loaded results (§9.2). Pure, so the presenter and the JSON
 * codec both work from the same data.
 */
export function reviewAppSecurityResults(
  results: AppSecurityResults,
  options: {resultsDirectory: string; checkIds: string[]; blocking: AppSecurityBlockingLevel},
): SecurityReviewResult {
  const filter = options.checkIds.length > 0 ? {checkIds: options.checkIds} : null
  const anyFilePresent = results.sources.deterministic !== null || results.sources.agent !== null
  // Without a file there's nothing to match against, so an unknown ID isn't an error: the summary alone is shown.
  if (filter && anyFilePresent) assertKnownCheckIds(filter.checkIds, results.checks)

  const checks = filter ? results.checks.filter((check) => filter.checkIds.includes(check.id)) : results.checks
  const numbered = numberFindings(results.checks)

  return {
    resultsDirectory: options.resultsDirectory,
    sources: results.sources,
    allChecks: results.checks,
    checks,
    filter,
    scopeDiffers: scopeDiffers(results.sources),
    suppressions: results.suppressions,
    findingNumbers: new Map(numbered.map(({finding, number}) => [finding, number])),
    resultsDigest: anyFilePresent ? resultsDigest(numbered) : null,
    blocking: {level: options.blocking, blockedChecks: blockedCheckCount(checks, options.blocking)},
  }
}

/**
 * Numbers every finding of every combined check, suppressed and superseded ones too, in the order `review` lists them:
 * checks most severe first, then by ID, and each check's findings by file, line, source and message. That order
 * depends only on the results files, so a number names the same finding for the same results files, whatever the
 * suppressions, `--check-id` and `--verbose`.
 */
export function numberFindings(checks: CombinedCheck[]): NumberedFinding[] {
  return checks
    .flatMap((check) => check.findings.map((finding) => ({check, finding})))
    .map((item, index) => ({...item, number: index + 1}))
}

/**
 * A short digest of the numbered findings as the results files store them, so it changes when a number could name
 * another finding, but not when only the suppressions or the times change. `--suppress` compares it with
 * `--results-digest`.
 */
function resultsDigest(numbered: NumberedFinding[]): string {
  const findings = numbered.map(
    ({check, finding: {disposition: _disposition, suppressed_by: _suppressedBy, ...finding}}) => [check.id, finding],
  )
  return sha256(JSON.stringify(findings)).toString('hex').slice(0, RESULTS_DIGEST_LENGTH)
}

/** Compares the scope blocks as recorded: the same values in the same order. */
function scopeDiffers({deterministic, agent}: AppSecurityResults['sources']): boolean {
  if (!deterministic || !agent) return false
  return JSON.stringify(deterministic.document.coverage.scope) !== JSON.stringify(agent.document.scope)
}

function assertKnownCheckIds(checkIds: string[], checks: CombinedCheck[]): void {
  const knownIds = new Set(checks.map((check) => check.id))
  const unknownIds = checkIds.filter((id) => !knownIds.has(id))
  if (unknownIds.length === 0) return

  const label = unknownIds.length === 1 ? 'check ID' : 'check IDs'
  const error = new AbortError(
    `Unknown ${label}: ${unknownIds.join(', ')}.`,
    'Pass --check-id with one of the checks in the results files.',
    [],
    [{title: 'Available check IDs', body: {list: {items: checks.map((check) => check.id)}}}],
  )
  error.code = 'unknown-check-id'
  error.details = {checkIds: unknownIds}
  throw error
}

/**
 * Reviews the combined app security check results (§9). Loads both result files and narrows them with `--check-id`.
 * Prints nothing: an error aborts, and everything else, including missing files, returns the reviewed results for
 * the presenter.
 */
export default async function securityReview(
  options: SecurityReviewOptions,
  dependencies: SecurityReviewDependencies = defaultDependencies,
): Promise<ReviewedAppSecurityResults> {
  const decision = options.suppress ? suppressionDecision(options.suppress) : undefined
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: false,
    validateClientIdFlag: true,
  })
  const review = async () => {
    const loaded = await dependencies.loadResults(selection, options.directory)
    const reviewed = reviewAppSecurityResults(loaded, {
      resultsDirectory: appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection)).resultsDirectory,
      checkIds: options.checkIds,
      blocking: options.blocking,
    })
    return {results: loaded, result: reviewed}
  }
  const loaded = await review()
  const savedSuppressions =
    options.suppress && decision
      ? await suppressFinding(selection, loaded.results, loaded.result, options.suppress, decision)
      : undefined
  // The save changes only shopify.app-security.json, so the numbers stay, and the finding now shows as suppressed.
  const {results, result} = savedSuppressions ? await review() : loaded

  // Every check, not just the --check-id ones, so the count doesn't depend on the filter. Without result files
  // there's nothing to count, so the field stays unset rather than reporting zero.
  if (result.sources.deterministic !== null || result.sources.agent !== null) {
    const findings = result.allChecks.reduce((total, check) => total + activeFindings(check).length, 0)
    await dependencies.recordMetadata({num_security_findings: findings})
  }

  return {
    selection,
    result,
    // The latest scan's scope, so running `check` again gathers the same files.
    commands: resolveAppSecurityCommands(
      selection,
      options.directory,
      results.sources.deterministic?.document.coverage.scope,
    ),
    ...(savedSuppressions ? {savedSuppressions} : {}),
  }
}

/** The kind and reason of `--suppress`, checked before anything is read. Aborts with every problem. */
function suppressionDecision(options: SecurityReviewSuppressOptions): SuppressionDecision {
  const parsed = parseSuppressionFlags(options)
  if (parsed.ok) return parsed.decision
  const error = new AbortError(
    'The suppression could not be saved because a flag is invalid.',
    'Pass --kind false-positive or --kind accepted-risk, and a --reason that explains the decision.',
    [],
    [{title: 'Errors', body: {list: {items: parsed.errors}}}],
  )
  error.code = 'suppression-flags-invalid'
  error.details = {errors: parsed.errors}
  throw error
}

/**
 * Saves an entry to shopify.app-security.json for the finding that `--suppress` numbers, as `planSuppression` plans
 * it, and one for each companion with `--include-superseded`. All or nothing: any refusal aborts before the write.
 */
async function suppressFinding(
  selection: AppSecuritySelection,
  results: AppSecurityResults,
  review: SecurityReviewResult,
  options: SecurityReviewSuppressOptions,
  decision: SuppressionDecision,
): Promise<SavedReviewSuppressions> {
  if (options.resultsDigest !== undefined && options.resultsDigest !== review.resultsDigest) {
    abortDigestMismatch(options.resultsDigest, review.resultsDigest)
  }
  const numbered = numberFindings(review.allChecks)
  const target = numbered.find(({number}) => number === options.findingNumber)
  if (!target) abortFindingNotFound(options.findingNumber, numbered.length)
  const companions = companionFindings(target, numbered)
  const alreadySuppressed = target.finding.disposition === 'suppressed'
  // `--include-superseded` on a finding that an entry already suppresses saves only its companions.
  const canAddCompanionsOnly =
    alreadySuppressed && options.includeSuperseded && target.finding.suppressed_by?.origin === 'file'
  if (target.finding.disposition === 'superseded' || (alreadySuppressed && !canAddCompanionsOnly)) {
    abortNotSuppressible(target)
  }
  const findings = [...(alreadySuppressed ? [] : [target]), ...(options.includeSuperseded ? companions : [])]
  if (findings.length === 0) abortNotSuppressible(target)

  const suppressionResults = {
    deterministic: results.sources.deterministic?.document ?? null,
    agent: results.sources.agent?.document ?? null,
    resultsKey: resultsKey(selection),
    configuration: suppressionConfiguration(selection),
  }
  const entries = results.suppressions.map(({entry}) => entry)
  const changes = findings.flatMap((numberedFinding): {findingNumber: number; change: SuppressionChange}[] => {
    const plan = planSuppression(storedTarget(results, numberedFinding), decision, suppressionResults, entries)
    if (plan.status === 'refused') abortNoUniqueEntry(numberedFinding, plan.problem)
    return plan.status === 'change' ? [{findingNumber: numberedFinding.number, change: plan.change}] : []
  })

  const {path, saved} = await saveAppSecuritySuppressions(
    selection.appDirectory,
    changes.map(({change}) => change),
  )
  return {
    path,
    saved: saved.map((savedSuppression, index) => ({
      ...savedSuppression,
      findingNumber: changes[index]!.findingNumber,
    })),
    companionNumbers: options.includeSuperseded ? [] : companions.map(({number}) => number),
  }
}

/**
 * The companions of an agent finding: the superseded deterministic findings of its check in its file that no entry
 * matched, on its line when there are any there. `check --blocking` reads no agent results, so it still counts them.
 */
function companionFindings(target: NumberedFinding, numbered: NumberedFinding[]): NumberedFinding[] {
  if (target.finding.source !== 'agent') return []
  const path = normalizePath(target.finding.location.file)
  const candidates = numbered.filter(
    ({check, finding}) =>
      check.id === target.check.id &&
      finding.source === 'deterministic' &&
      finding.disposition === 'superseded' &&
      finding.suppressed_by?.origin !== 'file' &&
      normalizePath(finding.location.file) === path,
  )
  const onSameLine = candidates.filter(({finding}) => finding.location.line === target.finding.location.line)
  return onSameLine.length > 0 ? onSameLine : candidates
}

/** The stored finding that a numbered finding was combined from, and its index in its source's stored check. */
function storedTarget(results: AppSecurityResults, {check, finding}: NumberedFinding): SuppressionTarget {
  const {source, disposition: _disposition, suppressed_by: _suppressedBy, ...storedFinding} = finding
  const storedCheck = results.sources[source]?.document.checks.find(({id}) => id === check.id)
  const findingIndex = storedCheck?.findings.findIndex((candidate) => isDeepStrictEqual(candidate, storedFinding)) ?? -1
  return {source, checkId: check.id, findingIndex, finding: storedFinding}
}

function abortDigestMismatch(givenDigest: string, resultsDigest: string | null): never {
  const error = new AbortError(
    `The results changed since digest ${givenDigest}, so the finding numbers may name other findings. Nothing was saved.`,
    'Run the review again, check the number of the finding, and pass the new digest with --results-digest.',
  )
  error.code = 'results-digest-mismatch'
  error.details = {resultsDigest}
  throw error
}

function abortFindingNotFound(findingNumber: number, findingCount: number): never {
  const error = new AbortError(
    `No finding has number ${findingNumber}. Nothing was saved.`,
    findingCount === 0
      ? 'The results have no findings.'
      : `The findings are numbered from 1 to ${findingCount}. Run the review to see their numbers.`,
  )
  error.code = 'finding-not-found'
  error.details = {findingNumber, findingCount}
  throw error
}

/** Refuses a suppressed or superseded finding, or a suppressed one whose companions are all suppressed. */
function abortNotSuppressible({number, check, finding}: NumberedFinding): never {
  const [message, tryMessage] = notSuppressibleText(number, check, finding)
  const error = new AbortError(`${message} Nothing was saved.`, tryMessage)
  error.code = 'finding-not-suppressible'
  error.details = {findingNumber: number, disposition: finding.disposition}
  throw error
}

function notSuppressibleText(number: number, check: CombinedCheck, finding: CombinedFinding): [string, string] {
  if (finding.disposition === 'superseded') {
    return [
      `Finding ${number} is superseded: the agent result for ${check.id} replaces the deterministic findings.`,
      'To suppress it for check --blocking, which reads no agent results, suppress the agent finding in the same file with --include-superseded.',
    ]
  }
  const by =
    finding.suppressed_by?.origin === 'file'
      ? `suppressions[${finding.suppressed_by.entry_index}] in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}`
      : 'the agent'
  return [
    `Finding ${number} is already suppressed by ${by}.`,
    `To change the suppression, edit ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
  ]
}

function abortNoUniqueEntry({number}: NumberedFinding, problem: string): never {
  const error = new AbortError(
    `Finding ${number} can't be suppressed: ${problem}. Nothing was saved.`,
    `Add an entry for it to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} by hand, with a code that names it alone.`,
  )
  error.code = 'finding-not-suppressible'
  error.details = {findingNumber: number}
  throw error
}
