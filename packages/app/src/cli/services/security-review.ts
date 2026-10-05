import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {resolveAppSecurityCommands} from './app-security-commands.js'
import {resolveAppSecuritySelection, resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {loadAppSecurityResults, type AppSecurityResults} from './app-security-results.js'
import {securityReviewJsonOutputSchema, toSecurityReviewJson} from './security-review-json.js'
import {renderSecurityReview, type SecurityReviewPresenterInput} from './security-review-output.js'
import {activeFindings, SEVERITY_RANK, type CombinedCheck} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {AppSecurityBlockingLevel} from './app-security-api.js'

interface SecurityReviewOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig?: boolean
  json: boolean
  verbose: boolean
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

export interface SecurityReviewDependencies {
  resolveSelection(options: SecurityReviewOptions): Promise<AppSecuritySelection>
  loadResults(selection: AppSecuritySelection, path: string): Promise<AppSecurityResults>
  output(content: string): void
  render(input: SecurityReviewPresenterInput): void
  now(): Date
  setExitCode(exitCode: number): void
}

const defaultDependencies: SecurityReviewDependencies = {
  resolveSelection: (options) =>
    resolveAppSecuritySelection({
      path: options.directory,
      config: options.configName,
      clientId: options.clientId,
      withoutAppConfig: options.withoutAppConfig,
      allowPrompts: false,
    }),
  loadResults: loadAppSecurityResults,
  output: outputResult,
  render: renderSecurityReview,
  now: () => new Date(),
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

function isBlockingBreached(result: SecurityReviewResult): boolean {
  return result.blocking.blockedChecks > 0
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
 * Shows the combined App Security results (§9). Loads both result files, narrows them with `--check-id`, then
 * prints JSON to stdout or renders the review to stderr. A `--blocking` breach sets the exit code after the
 * output; an error exits 1 and everything else, including missing files, exits 0.
 */
export default async function securityReview(
  options: SecurityReviewOptions,
  dependencies: SecurityReviewDependencies = defaultDependencies,
): Promise<void> {
  const selection = await dependencies.resolveSelection(options)
  const results = await dependencies.loadResults(selection, options.directory)
  const result = reviewAppSecurityResults(results, {
    resultsDirectory: appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection)).resultsDirectory,
    checkIds: options.checkIds,
    blocking: options.blocking,
  })

  if (options.json) {
    dependencies.output(securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result)))
  } else {
    dependencies.render({
      result,
      verbose: options.verbose,
      now: dependencies.now(),
      // The latest scan's scope, so running `check` again gathers the same files.
      commands: resolveAppSecurityCommands(
        selection,
        options.directory,
        results.sources.deterministic?.document.coverage.scope,
      ),
    })
  }

  if (isBlockingBreached(result)) dependencies.setExitCode(1)
}
