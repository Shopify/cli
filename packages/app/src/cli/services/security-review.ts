import {resolveAppSecurityCommands} from './app-security-commands.js'
import {resolveAppSecuritySelection} from './app-security-selection.js'
import {loadAppSecurityResults, type AppSecurityResults} from './app-security-results.js'
import {securityReviewJsonOutputSchema, toSecurityReviewJson} from './security-review-json.js'
import {renderSecurityReview, type SecurityReviewPresenterInput} from './security-review-output.js'
import {activeFindings, SEVERITY_RANK, type CombinedCheck} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {AppSecurityBlockingLevel} from './app-security-api.js'

interface SecurityReviewOptions {
  directory: string
  json: boolean
  verbose: boolean
  /** Exact check IDs from `--check-id`; empty means every check. */
  checkIds: string[]
  blocking: AppSecurityBlockingLevel
}

/** The reviewed results: the loaded sources, the checks after `--check-id`, and the blocking outcome. */
export interface SecurityReviewResult {
  appRoot: string
  sources: AppSecurityResults['sources']
  /** Every combined check, before `--check-id`. */
  allChecks: CombinedCheck[]
  /** The combined checks after `--check-id`, in canonical order. */
  checks: CombinedCheck[]
  filter: {checkIds: string[]} | null
  blocking: {
    level: AppSecurityBlockingLevel
    /** Filtered checks with an active finding at or above the level. Zero for `none`. */
    blockedChecks: number
  }
}

export interface SecurityReviewDependencies {
  resolveRoot(directory: string): Promise<string>
  loadResults(appRoot: string): Promise<AppSecurityResults>
  output(content: string): void
  render(input: SecurityReviewPresenterInput): void
  now(): Date
  setExitCode(exitCode: number): void
}

const defaultDependencies: SecurityReviewDependencies = {
  resolveRoot: async (directory) =>
    (await resolveAppSecuritySelection({path: directory, allowPrompts: false})).appDirectory,
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
  options: {appRoot: string; checkIds: string[]; blocking: AppSecurityBlockingLevel},
): SecurityReviewResult {
  const filter = options.checkIds.length > 0 ? {checkIds: options.checkIds} : null
  const anyFilePresent = results.sources.deterministic !== null || results.sources.agent !== null
  // Without a file there's nothing to match against, so an unknown ID isn't an error: the summary alone is shown.
  if (filter && anyFilePresent) assertKnownCheckIds(filter.checkIds, results.checks)

  const checks = filter ? results.checks.filter((check) => filter.checkIds.includes(check.id)) : results.checks

  return {
    appRoot: options.appRoot,
    sources: results.sources,
    allChecks: results.checks,
    checks,
    filter,
    blocking: {level: options.blocking, blockedChecks: countBlockedChecks(checks, options.blocking)},
  }
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
  const appRoot = await dependencies.resolveRoot(options.directory)
  const results = await dependencies.loadResults(appRoot)
  const result = reviewAppSecurityResults(results, {
    appRoot,
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
      commands: resolveAppSecurityCommands(appRoot),
    })
  }

  if (isBlockingBreached(result)) dependencies.setExitCode(1)
}
