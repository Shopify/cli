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
import {activeFindings, SEVERITY_RANK, type CombinedCheck} from './app-security-engine/index.js'
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
  blocking: {
    level: AppSecurityBlockingLevel
    /** Filtered checks with an active finding at or above the level. Zero for `none`. */
    blockedChecks: number
  }
}

/** What `securityReview` returns: the reviewed results, and the commands that the review suggests running next. */
export interface ReviewedAppSecurityResults {
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

  return {
    resultsDirectory: options.resultsDirectory,
    sources: results.sources,
    allChecks: results.checks,
    checks,
    filter,
    scopeDiffers: scopeDiffers(results.sources),
    blocking: {level: options.blocking, blockedChecks: countBlockedChecks(checks, options.blocking)},
  }
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

function assertKnownCheckIds(checkIds: string[], checks: CombinedCheck[]): void {
  const knownIds = new Set(checks.map((check) => check.id))
  const unknownIds = checkIds.filter((id) => !knownIds.has(id))
  if (unknownIds.length === 0) return

  const label = unknownIds.length === 1 ? 'check ID' : 'check IDs'
  throw new AbortError(
    `Unknown ${label}: ${unknownIds.join(', ')}.`,
    'Pass --check-id with one of the checks in the results files.',
    [],
    [{title: 'Available check IDs', body: {list: {items: checks.map((check) => check.id)}}}],
  )
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
  })

  // Every check, not just the --check-id ones, so the count doesn't depend on the filter. Without result files
  // there's nothing to count, so the field stays unset rather than reporting zero.
  if (result.sources.deterministic !== null || result.sources.agent !== null) {
    const findings = result.allChecks.reduce((total, check) => total + activeFindings(check).length, 0)
    await dependencies.recordMetadata({num_security_findings: findings})
  }

  return {
    result,
    // The latest scan's scope, so running `check` again gathers the same files.
    commands: resolveAppSecurityCommands(
      selection,
      options.directory,
      results.sources.deterministic?.document.coverage.scope,
    ),
  }
}
