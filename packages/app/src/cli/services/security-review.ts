import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {resolveAppSecurityCommands, type AppSecurityCommands} from './app-security-commands.js'
import {
  resolveAppSecuritySelection,
  resultsKey,
  type AppSecuritySelection,
  type AppSecuritySelectionOptions,
} from './app-security-selection.js'
import {loadAppSecurityResults, type AppSecurityResults} from './app-security-results.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {activeFindings, listSettleableCheckIds, SEVERITY_RANK, type CombinedCheck} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AppSecurityBlockingLevel} from './app-security-api.js'

interface SecurityReviewOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig?: boolean
  /** Exact check IDs from `--check-id`; empty means every check. */
  checkIds: string[]
  blocking: AppSecurityBlockingLevel
  failOnUnresolved?: boolean
}

/** The reviewed results: the loaded sources, the checks after `--check-id`, and what fails the review. */
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
  blocking: {
    level: AppSecurityBlockingLevel
    /** Filtered checks with an active finding at or above the level. Zero for `none`. */
    blockedChecks: number
  }
  failOnUnresolved: boolean
  /** Filtered checks whose combined status is unresolved. */
  unresolvedChecks: number
  /** The IDs of the filtered settleable checks that neither results file has, sorted. */
  missingCheckIds: string[]
}

/** What `securityReview` returns: the selected app, its reviewed results, and the commands to run next. */
export interface ReviewedAppSecurityResults {
  selection: AppSecuritySelection
  result: SecurityReviewResult
  commands: AppSecurityCommands
}

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
 * Applies `--check-id`, `--blocking` and `--fail-on-unresolved` to the loaded results (§9.2). Pure, so the presenter
 * and the JSON codec both work from the same data.
 */
export function reviewAppSecurityResults(
  results: AppSecurityResults,
  options: {
    resultsDirectory: string
    checkIds: string[]
    blocking: AppSecurityBlockingLevel
    failOnUnresolved?: boolean
  },
): SecurityReviewResult {
  const filter = options.checkIds.length > 0 ? {checkIds: options.checkIds} : null
  const failOnUnresolved = options.failOnUnresolved ?? false
  const anyFilePresent = results.sources.deterministic !== null || results.sources.agent !== null
  const missingIds = listMissingCheckIds(results.checks)
  // Without a file there's nothing to match against, so an unknown ID isn't an error: the summary alone is shown.
  // With --fail-on-unresolved a check without results is still reviewed, so its ID is known, with or without a file.
  if (filter && (anyFilePresent || failOnUnresolved)) {
    const recordedIds = results.checks.map((check) => check.id)
    assertKnownCheckIds(filter.checkIds, failOnUnresolved ? [...recordedIds, ...missingIds] : recordedIds)
  }

  const checks = filter ? results.checks.filter((check) => filter.checkIds.includes(check.id)) : results.checks

  return {
    resultsDirectory: options.resultsDirectory,
    sources: results.sources,
    allChecks: results.checks,
    checks,
    filter,
    scopeDiffers: scopeDiffers(results.sources),
    blocking: {level: options.blocking, blockedChecks: countBlockedChecks(checks, options.blocking)},
    failOnUnresolved,
    unresolvedChecks: checks.filter((check) => check.status === 'unresolved').length,
    missingCheckIds: filter ? missingIds.filter((id) => filter.checkIds.includes(id)) : missingIds,
  }
}

/** Whether the review fails `--blocking` or `--fail-on-unresolved`: decides the exit code and `valid`. */
export function reviewFailed(
  result: Pick<SecurityReviewResult, 'blocking' | 'failOnUnresolved' | 'unresolvedChecks' | 'missingCheckIds'>,
): boolean {
  return (
    result.blocking.blockedChecks > 0 ||
    (result.failOnUnresolved && (result.unresolvedChecks > 0 || result.missingCheckIds.length > 0))
  )
}

/** The settleable checks that neither results file has, such as one the agent never recorded, sorted by ID. */
function listMissingCheckIds(recorded: CombinedCheck[]): string[] {
  const recordedIds = new Set(recorded.map((check) => check.id))
  return listSettleableCheckIds().filter((id) => !recordedIds.has(id))
}

/** Compares the scope blocks as recorded: the same values in the same order. */
function scopeDiffers({deterministic, agent}: AppSecurityResults['sources']): boolean {
  if (!deterministic || !agent) return false
  return JSON.stringify(deterministic.document.coverage.scope) !== JSON.stringify(agent.document.scope)
}

/**
 * A check blocks when it has an active finding and its severity is at or above the level, whatever its status.
 * Unresolved status alone never blocks: an unresolved check without active findings passes the gate.
 */
function countBlockedChecks(checks: CombinedCheck[], level: AppSecurityBlockingLevel): number {
  if (level === 'none') return 0
  return checks.filter(
    (check) => activeFindings(check).length > 0 && SEVERITY_RANK[check.severity] >= SEVERITY_RANK[level],
  ).length
}

function assertKnownCheckIds(checkIds: string[], availableIds: string[]): void {
  const unknownIds = checkIds.filter((id) => !availableIds.includes(id))
  if (unknownIds.length === 0) return

  const label = unknownIds.length === 1 ? 'check ID' : 'check IDs'
  const error = new AbortError(
    `Unknown ${label}: ${unknownIds.join(', ')}.`,
    'Pass --check-id with one of the available check IDs.',
    [],
    [{title: 'Available check IDs', body: {list: {items: availableIds}}}],
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
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: false,
    validateClientIdFlag: true,
  })
  const results = await dependencies.loadResults(selection, options.directory)
  const result = reviewAppSecurityResults(results, {
    resultsDirectory: appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection)).resultsDirectory,
    checkIds: options.checkIds,
    blocking: options.blocking,
    failOnUnresolved: options.failOnUnresolved,
  })

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
  }
}
