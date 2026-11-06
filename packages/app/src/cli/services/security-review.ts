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
  planReattachment,
  planSuppression,
  saveAppSecuritySuppressions,
  suppressionConfiguration,
  type AppSecuritySuppression,
  type SavedSuppression,
  type SuppressionDecision,
  type SuppressionPlan,
  type SuppressionResults,
  type SuppressionTarget,
} from './app-security-suppressions.js'
import {
  activeFindings,
  type CombinedCheck,
  type CombinedFinding,
  type StoredFinding,
  type SuppressionEntryResult,
} from './app-security-engine/index.js'
import {blockedCheckCount, type AppSecurityBlockingLevel} from './app-security-api.js'
import {countLabel, listedNumbers} from './app-security-format.js'
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
  /** `--interactive`: the session that offers each active finding. Absent without `--interactive`, and with `--suppress`. */
  interactive?: InteractiveSecurityReview
}

/** The flags of `review --suppress`, as typed. */
export interface SecurityReviewSuppressOptions {
  findingNumber: number
  /**
   * `false-positive` or `accepted-risk`. With the reason, required for a new entry. Optional when the finding is the
   * likely finding of a stale entry, which `--suppress` re-attaches: the entry then keeps its own unless they're given.
   */
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
  /**
   * The number of each stale entry's likely finding (`likely_finding`), by the entry's index: the finding that
   * `--suppress` re-attaches the entry to.
   */
  likelyFindingNumbers: ReadonlyMap<number, number>
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
  /** How the `--interactive` session ended, and what it saved. Absent without `--interactive`. */
  interactiveReview?: InteractiveReviewOutcome
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
export interface NumberedFinding {
  number: number
  check: CombinedCheck
  finding: CombinedFinding
}

/**
 * Why `--suppress` can't save a suppression for a finding: the error that `--suppress` aborts with, and that
 * `--interactive` shows before it goes on. Nothing is saved then.
 */
export interface SuppressionRefusal {
  code: 'results-digest-mismatch' | 'finding-not-found' | 'finding-not-suppressible' | 'suppression-flags-invalid'
  message: string
  tryMessage: string
  details: unknown
  /** For `suppression-flags-invalid` only: the problem of each missing flag, which the error lists. */
  errors?: string[]
}

/** What saving a suppression for a numbered finding did: the entries it saved, or why it saved nothing. */
export type FindingSuppressionResult =
  | {status: 'saved'; savedSuppressions: SavedReviewSuppressions}
  | {status: 'refused'; refusal: SuppressionRefusal}

/**
 * The `--interactive` session. It offers each finding of `session.findings`, saves each decision at once through
 * `session.suppress`, and returns what it saved. `securityReview` runs it after it reads the results, and then reviews
 * them again, so the result shows what the session saved.
 */
export type InteractiveSecurityReview = (session: InteractiveReviewSession) => Promise<InteractiveReviewOutcome>

export interface InteractiveReviewSession {
  /** The reviewed results when the session starts. */
  result: SecurityReviewResult
  /** The app configuration that new entries list, such as `shopify.app.toml`. */
  configuration: string
  /** The active findings of the checks that `--check-id` selects, most severe first: the findings the session offers. */
  findings: NumberedFinding[]
  /**
   * The superseded deterministic findings of the selected checks that no entry suppresses, most severe first. The
   * review doesn't count them, but `check --blocking`, which reads no agent results, does, so the session offers them
   * after `findings`.
   */
  supersededFindings: NumberedFinding[]
  /**
   * Saves a suppression for a finding of `findings` as `--suppress` does, with the same planner, writer and refusals.
   * The results are read again first, and the digest of `result` is checked, so a number that may name another
   * finding is refused (`results-digest-mismatch`). The likely finding of a stale entry re-attaches that entry, with
   * the decision's kind and reason.
   */
  suppress(request: InteractiveSuppressionRequest): Promise<FindingSuppressionResult>
  /**
   * The stale entries that the session can re-attach to their likely findings, by the finding's number, each with the
   * code that it would get. A finding that no code names alone has none.
   */
  reattachments: ReadonlyMap<number, ReattachmentOffer>
  /**
   * Re-attaches the stale entry of `reattachments` to the finding as `--suppress` does without `--kind` and
   * `--reason`: the entry keeps its kind and reason, and gets the finding's code. The results are read again first, and
   * a finding that is no longer the likely finding of a stale entry is refused.
   */
  reattach(findingNumber: number): Promise<FindingSuppressionResult>
}

/** A stale entry of shopify.app-security.json, and the code that re-attaching it to its likely finding gives it. */
export interface ReattachmentOffer {
  entryIndex: number
  entry: AppSecuritySuppression
  code: string
}

export interface InteractiveSuppressionRequest {
  findingNumber: number
  decision: SuppressionDecision
  /** Suppress the finding's companions too, as `--include-superseded` does: them alone when an entry suppresses the finding. */
  includeSuperseded: boolean
}

/** What the `--interactive` session saved, and how it ended. */
export interface InteractiveReviewOutcome {
  /** Each saved entry with the number of the finding it was saved for, in the order of the decisions. */
  saved: SavedReviewSuppressions['saved']
  /** For each suppressed agent finding whose companions the person chose not to suppress, the companions' numbers. */
  declinedCompanions: {findingNumber: number; companionNumbers: number[]}[]
  /** Every finding was offered, the person chose Quit, or the session stopped because the results changed. */
  ending: 'finished' | 'quit' | 'results-changed'
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
    likelyFindingNumbers: likelyFindingNumbers(results, numbered),
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
 * The number of each stale entry's likely finding, by the entry's index. The matching names the finding by its index in
 * its source's stored check, and a combined finding holds the stored finding's fields.
 */
function likelyFindingNumbers(results: AppSecurityResults, numbered: NumberedFinding[]): ReadonlyMap<number, number> {
  return new Map(
    results.suppressions.flatMap(({index, entry, likely_finding: likelyFinding}): [number, number][] => {
      if (likelyFinding === undefined) return []
      const storedCheck = results.sources[entry.source]?.document.checks.find(({id}) => id === entry.check)
      const stored = storedCheck?.findings[likelyFinding.index]
      const match = numbered.find(
        ({check, finding}) =>
          check.id === entry.check &&
          finding.source === entry.source &&
          isDeepStrictEqual(storedFindingOf(finding), stored),
      )
      return match ? [[index, match.number]] : []
    }),
  )
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
 * Prints nothing itself: an error aborts, and everything else, including missing files, returns the reviewed results
 * for the presenter. With `--interactive`, it runs the session that the command passes, between two reviews.
 */
export default async function securityReview(
  options: SecurityReviewOptions,
  dependencies: SecurityReviewDependencies = defaultDependencies,
): Promise<ReviewedAppSecurityResults> {
  const decision = options.suppress ? givenSuppressionDecision(options.suppress) : undefined
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
      ? savedOrAbort(await suppressFinding(selection, loaded.results, loaded.result, options.suppress, decision))
      : undefined
  const interactiveReview = options.interactive
    ? await options.interactive({
        result: loaded.result,
        configuration: suppressionConfiguration(selection),
        findings: interactiveReviewFindings(loaded.result, isActive),
        supersededFindings: interactiveReviewFindings(loaded.result, isCountedByCheckBlocking),
        suppress: async ({findingNumber, decision: requestDecision, includeSuperseded}) => {
          const current = await review()
          const suppressOptions = {
            findingNumber,
            resultsDigest: loaded.result.resultsDigest ?? undefined,
            includeSuperseded,
          }
          return suppressFinding(selection, current.results, current.result, suppressOptions, requestDecision)
        },
        reattachments: reattachmentOffers(selection, loaded.results, loaded.result),
        reattach: async (findingNumber) => {
          const current = await review()
          const reattachOptions = {
            findingNumber,
            resultsDigest: loaded.result.resultsDigest ?? undefined,
            includeSuperseded: false,
            reattachOnly: true,
          }
          return suppressFinding(selection, current.results, current.result, reattachOptions, {})
        },
      })
    : undefined
  // A save changes only shopify.app-security.json, so the numbers stay, and the finding now shows as suppressed.
  const {results, result} = savedSuppressions !== undefined || interactiveReview !== undefined ? await review() : loaded

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
    ...(interactiveReview ? {interactiveReview} : {}),
  }
}

/** The findings of the checks that `--check-id` selects that `include` keeps, in the order of their numbers: most severe first. */
function interactiveReviewFindings(
  result: SecurityReviewResult,
  include: (finding: CombinedFinding) => boolean,
): NumberedFinding[] {
  const selectedCheckIds = new Set(result.checks.map((check) => check.id))
  return numberFindings(result.allChecks).filter(
    ({check, finding}) => selectedCheckIds.has(check.id) && include(finding),
  )
}

function isActive(finding: CombinedFinding): boolean {
  return finding.disposition === 'active'
}

/**
 * A superseded deterministic finding that no entry matched. The agent result replaces it in the review, but
 * `check --blocking` reads no agent results, so it still counts it.
 */
function isCountedByCheckBlocking(finding: CombinedFinding): boolean {
  return finding.disposition === 'superseded' && finding.suppressed_by === undefined
}

function savedOrAbort(result: FindingSuppressionResult): SavedReviewSuppressions {
  if (result.status === 'saved') return result.savedSuppressions
  const {code, message, tryMessage, details, errors} = result.refusal
  if (errors !== undefined) throw invalidSuppressionFlagsError(errors)
  const error = new AbortError(message, tryMessage)
  error.code = code
  error.details = details
  throw error
}

/**
 * The kind and reason that `--suppress` was given, checked before anything is read. Aborts with every problem of a
 * given flag. A flag that isn't given is checked once the results are read, because the likely finding of a stale
 * entry doesn't need it.
 */
function givenSuppressionDecision(options: SecurityReviewSuppressOptions): Partial<SuppressionDecision> {
  const parsed = parseSuppressionFlags(options)
  if (parsed.ok) return parsed.decision
  throw invalidSuppressionFlagsError(parsed.errors)
}

const SUPPRESSION_FLAGS_MESSAGE = 'The suppression could not be saved because a flag is invalid.'
const SUPPRESSION_FLAGS_TRY_MESSAGE =
  'Pass --kind false-positive or --kind accepted-risk, and a --reason that explains the decision.'

function invalidSuppressionFlagsError(errors: string[]): AbortError {
  const error = new AbortError(
    SUPPRESSION_FLAGS_MESSAGE,
    SUPPRESSION_FLAGS_TRY_MESSAGE,
    [],
    [{title: 'Errors', body: {list: {items: errors}}}],
  )
  error.code = 'suppression-flags-invalid'
  error.details = {errors}
  return error
}

/** Refuses a finding that needs a new entry when `--kind` or `--reason` isn't given, with the errors of the missing flags. */
function missingFlags(given: Partial<SuppressionDecision>): SuppressionRefusal {
  const parsed = parseSuppressionFlags({kind: given.kind, reason: given.reason})
  const errors = parsed.ok ? parsed.missing : parsed.errors
  return {
    code: 'suppression-flags-invalid',
    message: SUPPRESSION_FLAGS_MESSAGE,
    tryMessage: SUPPRESSION_FLAGS_TRY_MESSAGE,
    details: {errors},
    errors,
  }
}

/** The kind and reason of a new entry, when both are given. */
function completeDecision({kind, reason}: Partial<SuppressionDecision>): SuppressionDecision | undefined {
  return kind === undefined || reason === undefined ? undefined : {kind, reason}
}

/** The kind and reason of a re-attached entry: its own, unless they're given. */
function keptDecision(entry: AppSecuritySuppression, given: Partial<SuppressionDecision>): SuppressionDecision {
  return {kind: given.kind ?? entry.kind, reason: given.reason ?? entry.reason}
}

/** The stale entry whose likely finding has this number, if any. */
function reattachedEntry(
  results: AppSecurityResults,
  review: SecurityReviewResult,
  findingNumber: number,
): {index: number; entry: AppSecuritySuppression} | undefined {
  const [index] = [...review.likelyFindingNumbers].find(([, number]) => number === findingNumber) ?? []
  const entry = index === undefined ? undefined : results.suppressions[index]?.entry
  return index === undefined || entry === undefined ? undefined : {index, entry}
}

/** The stored results that new and re-attached entries must match, with the run's results key and configuration. */
function suppressionResultsOf(selection: AppSecuritySelection, results: AppSecurityResults): SuppressionResults {
  return {
    deterministic: results.sources.deterministic?.document ?? null,
    agent: results.sources.agent?.document ?? null,
    resultsKey: resultsKey(selection),
    configuration: suppressionConfiguration(selection),
  }
}

/** The stale entries that `--interactive` can re-attach, by their likely finding's number, each with its new code. */
function reattachmentOffers(
  selection: AppSecuritySelection,
  results: AppSecurityResults,
  review: SecurityReviewResult,
): ReadonlyMap<number, ReattachmentOffer> {
  const numbered = numberFindings(review.allChecks)
  const entries = results.suppressions.map(({entry}) => entry)
  return new Map(
    [...review.likelyFindingNumbers].flatMap(([entryIndex, findingNumber]): [number, ReattachmentOffer][] => {
      const target = numbered.find(({number}) => number === findingNumber)
      const entry = entries[entryIndex]
      if (!target || !entry) return []
      const plan = planReattachment(
        storedTarget(results, target),
        entryIndex,
        keptDecision(entry, {}),
        suppressionResultsOf(selection, results),
        entries,
      )
      if (plan.status !== 'change' || plan.change.type !== 'replace-code') return []
      return [[findingNumber, {entryIndex, entry, code: plan.change.code}]]
    }),
  )
}

/**
 * Saves an entry to shopify.app-security.json for the finding that `--suppress` numbers, as `planSuppression` plans
 * it, and one for each companion with `--include-superseded`. A finding that is the likely finding of a stale entry
 * re-attaches that entry instead, as `planReattachment` plans it: the entry keeps its kind and reason unless they're
 * given, and only such a finding does without them. All or nothing: any refusal returns before the write. A superseded
 * deterministic finding can be numbered too, because `check --blocking` still counts it until an entry matches it.
 * With `reattachOnly`, a finding that isn't the likely finding of a stale entry is refused.
 */
async function suppressFinding(
  selection: AppSecuritySelection,
  results: AppSecurityResults,
  review: SecurityReviewResult,
  options: Pick<SecurityReviewSuppressOptions, 'findingNumber' | 'resultsDigest' | 'includeSuperseded'> & {
    reattachOnly?: boolean
  },
  given: Partial<SuppressionDecision>,
): Promise<FindingSuppressionResult> {
  if (options.resultsDigest !== undefined && options.resultsDigest !== review.resultsDigest) {
    return refused(digestMismatch(options.resultsDigest, review.resultsDigest))
  }
  const numbered = numberFindings(review.allChecks)
  const target = numbered.find(({number}) => number === options.findingNumber)
  const targetEntry = target ? reattachedEntry(results, review, target.number) : undefined
  if (options.reattachOnly && !targetEntry) return refused(noLongerLikely(options.findingNumber))
  const decision = targetEntry ? keptDecision(targetEntry.entry, given) : completeDecision(given)
  if (!decision) return refused(missingFlags(given))
  if (!target) return refused(findingNotFound(options.findingNumber, numbered.length))
  const companions = companionFindings(target, numbered)
  // A superseded finding that an entry matched is suppressed for `check --blocking`, the only command that counts it.
  const alreadySuppressed = target.finding.suppressed_by !== undefined
  // `--include-superseded` on a finding that an entry already suppresses saves only its companions.
  const canAddCompanionsOnly =
    alreadySuppressed && options.includeSuperseded && target.finding.suppressed_by?.origin === 'file'
  if (alreadySuppressed && !canAddCompanionsOnly) return refused(notSuppressible(target))
  const findings = [...(alreadySuppressed ? [] : [target]), ...(options.includeSuperseded ? companions : [])]
  if (findings.length === 0) return refused(notSuppressible(target))

  const suppressionResults = suppressionResultsOf(selection, results)
  const entries = results.suppressions.map(({entry}) => entry)
  const plans = findings.map((numberedFinding) => {
    const stored = storedTarget(results, numberedFinding)
    const reattached = reattachedEntry(results, review, numberedFinding.number)
    return {
      numberedFinding,
      plan: reattached
        ? planReattachment(stored, reattached.index, keptDecision(reattached.entry, given), suppressionResults, entries)
        : planSuppression(stored, decision, suppressionResults, entries),
    }
  })
  const refusedPlan = plans.find(({plan}) => plan.status === 'refused')
  if (refusedPlan?.plan.status === 'refused') {
    return refused(noUniqueEntry(refusedPlan.numberedFinding, refusedPlan.plan, numbered))
  }
  const changes = plans.flatMap(({numberedFinding, plan}) =>
    plan.status === 'change' ? [{findingNumber: numberedFinding.number, change: plan.change}] : [],
  )

  const {path, saved} = await saveAppSecuritySuppressions(
    selection.appDirectory,
    changes.map(({change}) => change),
  )
  return {
    status: 'saved',
    savedSuppressions: {
      path,
      saved: saved.map((savedSuppression, index) => ({
        ...savedSuppression,
        findingNumber: changes[index]!.findingNumber,
      })),
      companionNumbers: options.includeSuperseded ? [] : companions.map(({number}) => number),
    },
  }
}

function refused(refusal: SuppressionRefusal): FindingSuppressionResult {
  return {status: 'refused', refusal}
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
  const {source} = finding
  const storedFinding = storedFindingOf(finding)
  const storedCheck = results.sources[source]?.document.checks.find(({id}) => id === check.id)
  const findingIndex = storedCheck?.findings.findIndex((candidate) => isDeepStrictEqual(candidate, storedFinding)) ?? -1
  return {source, checkId: check.id, findingIndex, finding: storedFinding}
}

/** The fields of a combined finding that its results file stores. */
function storedFindingOf(finding: CombinedFinding): StoredFinding {
  const {source: _source, disposition: _disposition, suppressed_by: _suppressedBy, ...storedFinding} = finding
  return storedFinding
}

/** Refuses Re-attach in `--interactive` for a finding that is no longer the likely finding of a stale entry. */
function noLongerLikely(findingNumber: number): SuppressionRefusal {
  return {
    code: 'finding-not-suppressible',
    message: `Finding ${findingNumber} is no longer the likely finding of a stale entry. Nothing was saved.`,
    tryMessage: `Choose Suppress to save a new entry for it, or run the review again to see the stale entries of ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
    details: {findingNumber},
  }
}

function digestMismatch(givenDigest: string, resultsDigest: string | null): SuppressionRefusal {
  return {
    code: 'results-digest-mismatch',
    message: `The results changed since digest ${givenDigest}, so the finding numbers may name other findings. Nothing was saved.`,
    tryMessage: 'Run the review again, check the number of the finding, and pass the new digest with --results-digest.',
    details: {resultsDigest},
  }
}

function findingNotFound(findingNumber: number, findingCount: number): SuppressionRefusal {
  return {
    code: 'finding-not-found',
    message: `No finding has number ${findingNumber}. Nothing was saved.`,
    tryMessage:
      findingCount === 0
        ? 'The results have no findings.'
        : `The findings are numbered from 1 to ${findingCount}. Run the review to see their numbers.`,
    details: {findingNumber, findingCount},
  }
}

/** Refuses a suppressed finding, or a suppressed one whose companions are all suppressed. */
function notSuppressible({number, finding}: NumberedFinding): SuppressionRefusal {
  const by =
    finding.suppressed_by?.origin === 'file'
      ? `suppressions[${finding.suppressed_by.entry_index}] in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}`
      : 'the agent'
  return {
    code: 'finding-not-suppressible',
    message: `Finding ${number} is already suppressed by ${by}. Nothing was saved.`,
    tryMessage: `To change the suppression, edit ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}.`,
    details: {findingNumber: number, disposition: finding.disposition},
  }
}

/**
 * Refuses a finding that no saved entry can name alone. The advice names what a person can add by hand: an entry with a
 * more specific code, only when one can name the finding alone, or else an entry without code, which suppresses every
 * finding of the finding's source and check in its file. When the entry would be invalid, an entry by hand would be
 * invalid too, so the advice says why and what works instead.
 */
function noUniqueEntry(
  target: NumberedFinding,
  plan: Extract<SuppressionPlan, {status: 'refused'}>,
  numbered: NumberedFinding[],
): SuppressionRefusal {
  return {
    code: 'finding-not-suppressible',
    message: `Finding ${target.number} can't be suppressed: ${plan.problem}. Nothing was saved.`,
    tryMessage: noUniqueEntryAdvice(target, plan, numbered),
    details: {findingNumber: target.number},
  }
}

function noUniqueEntryAdvice(
  target: NumberedFinding,
  {withoutCode, invalidFields}: Extract<SuppressionPlan, {status: 'refused'}>,
  numbered: NumberedFinding[],
): string {
  if (invalidFields) return invalidEntryAdvice(target, invalidFields)
  if (withoutCode) return entryWithoutCodeAdvice(target, numbered)
  return `Add an entry for it to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} by hand, with a code that names it alone.`
}

/**
 * "This version of the CLI has no deterministic check X, …. To update them, run check again." An entry by hand names
 * the same check and path as the refused one, so the advice never asks for one.
 */
function invalidEntryAdvice({check, finding}: NumberedFinding, invalidFields: string[]): string {
  if (invalidFields.includes('check')) {
    // `check` rewrites deterministic-findings.json, and only the coding agent rewrites agent-findings.json.
    const update =
      finding.source === 'agent' ? 'have your coding agent run check and record its findings again' : 'run check again'
    return [
      `This version of the CLI has no ${finding.source} check ${check.id}, so an entry for it by hand would make ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} invalid too.`,
      `The results are from another version of the CLI. To update them, ${update}.`,
    ].join(' ')
  }
  if (invalidFields.includes('path')) {
    return [
      `${APP_SECURITY_SUPPRESSIONS_FILE_NAME} can't name the path ${normalizePath(finding.location.file)}, so no entry can suppress this finding.`,
      'An entry for it by hand would make the file invalid too.',
    ].join(' ')
  }
  return `An entry for it by hand with the same values would make ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} invalid too.`
}

/** "No code from its lines, … names it alone. A deterministic entry for X in a.ts without code suppresses all 2 …: 3 and 4. …" */
function entryWithoutCodeAdvice({number, check, finding}: NumberedFinding, numbered: NumberedFinding[]): string {
  const path = normalizePath(finding.location.file)
  const numbers = numbered
    .filter(
      (other) =>
        other.check.id === check.id &&
        other.finding.source === finding.source &&
        normalizePath(other.finding.location.file) === path,
    )
    .map((other) => other.number)
  const entry = finding.source === 'agent' ? 'An agent entry' : 'A deterministic entry'
  return [
    'No code from its lines, evidence or message names it alone.',
    `${entry} for ${check.id} in ${path} without code suppresses all ${countLabel(numbers.length, `${finding.source} finding`)} of that check in that file: ${listedNumbers(numbers)}.`,
    `To suppress them all, add such an entry to ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} by hand.`,
    `To suppress only finding ${number}, change the code so that the findings differ, and run check again.`,
  ].join(' ')
}
