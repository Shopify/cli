import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {resolveAppDoctorEvidencePath, resolveAppDoctorScopeDirectory} from './app-doctor-engine/index.js'
import {renderAppDoctorStatusReport} from './app-doctor-report.js'
import {
  appDoctorStatusJsonOutputSchema,
  type AppDoctorStatusFinding,
  type AppDoctorStatusModeOutcome,
  type AppDoctorStatusResult,
  type AppDoctorStatusScope,
} from './app-doctor-status-json.js'
import {readAppDoctorStoredResults, type AppDoctorStoredResults} from './app-doctor-stored-results.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {
  AppDoctorContext,
  AppDoctorImmediateDiagnostic,
  AppDoctorInterpretation,
  AppDoctorInterpretedFinding,
  AppDoctorInterpretedScope,
  AppDoctorModeOutcome,
  AppDoctorPathReference,
} from './app-doctor-engine/index.js'

export type AppDoctorStatusFormat = 'json' | 'text'

export interface AppDoctorStatusOptions {
  readonly directory?: string
  readonly configName?: string
  readonly clientId?: string
  /** Decided by the caller (typically `isTerminalInteractive()`); prompts are only shown when true. */
  readonly interactive: boolean
}

export interface AppDoctorStatusDependencies {
  resolveContext(options: ResolveAppDoctorContextOptions): Promise<AppDoctorContext>
}

const defaultDependencies: AppDoctorStatusDependencies = {
  resolveContext: resolveAppDoctorContext,
}

const describeDiagnostic = (diagnostic: AppDoctorImmediateDiagnostic): string =>
  `- ${diagnostic.code}: ${diagnostic.message}${diagnostic.path === undefined ? '' : ` (${diagnostic.path})`}`

interface StoreReading extends AppDoctorStoredResults {
  readonly store: AppDoctorStatusResult['store']['state']
}

/** A missing store is a normal state; only an unusable one is an error. */
async function readStore(context: AppDoctorContext): Promise<StoreReading> {
  const read = await readAppDoctorStoredResults(context)
  if (read.store === 'unavailable') {
    // The results enumeration and the suppressions read each report the same unusable store; say it once.
    const problems = new Set(read.interpretation.diagnostics.map(describeDiagnostic))
    throw new AbortError(
      `App Doctor can't read its result store at ${context.storeDirectory}.\n${[...problems].join('\n')}`,
      'Move or remove whatever is in the way, then run `shopify app doctor status` again.',
    )
  }
  return {...read, store: read.store}
}

function toModeOutcome(outcome: AppDoctorModeOutcome): AppDoctorStatusModeOutcome {
  if (outcome.outcome === 'not_run') return {outcome: 'not_run'}
  return {
    outcome: outcome.outcome,
    produced_at: outcome.producedAt,
    check_version: outcome.checkVersion,
    finding_count: outcome.findingCount,
    ...(outcome.reason === undefined ? {} : {reason: {code: outcome.reason.code, message: outcome.reason.message}}),
    ...(outcome.guidance === undefined ? {} : {guidance: outcome.guidance}),
  }
}

interface ScopeDirectory {
  readonly directory: string
  readonly resolved: boolean
}

/** The recorded reference in the evidence-path spelling (`anchor/<up>/<path>` or `volume/<token>/<path>`). */
function describeReference(reference: AppDoctorPathReference): string {
  const qualifier =
    reference.base === 'storage_anchor'
      ? `anchor/${reference.up}`
      : `volume/${reference.volume_token.slice('sha256:'.length)}`
  return `${qualifier}/${reference.path}`
}

/**
 * Where a scope's directory is on this machine, without touching the filesystem.
 * The inventory knows the current review scopes (today, only the app root);
 * every other scope is projected from the descriptor its results were recorded
 * with, so a reviewed subdirectory is named by path rather than by identity.
 */
function scopeDirectory(
  scope: AppDoctorInterpretedScope,
  currentDirectories: ReadonlyMap<string, string>,
  storageAnchor: string,
): ScopeDirectory {
  const current = currentDirectories.get(scope.scopeIdentity)
  if (current !== undefined) return {directory: current, resolved: true}
  const references = scope.descriptors.map((descriptor) => descriptor.directory)
  for (const reference of references) {
    const resolved = resolveAppDoctorScopeDirectory(reference, storageAnchor)
    if (resolved !== undefined) return {directory: resolved, resolved: true}
  }
  const [reference] = references
  return {directory: reference === undefined ? scope.scopeIdentity : describeReference(reference), resolved: false}
}

function toScope(scope: AppDoctorInterpretedScope, location: ScopeDirectory): AppDoctorStatusScope {
  return {
    scope_identity: scope.scopeIdentity,
    directory: location.directory,
    directory_resolved: location.resolved,
    checks: scope.checks.map((check) => ({
      check_id: check.checkId,
      static: toModeOutcome(check.static),
      agent: toModeOutcome(check.agent),
    })),
  }
}

function toFinding(finding: AppDoctorInterpretedFinding, storageAnchor: string): AppDoctorStatusFinding {
  const {location, suppression, fix} = finding
  // `location.file` is the recorded evidence reference, not a local path; the local spelling is projected
  // from today's storage anchor and is absent when the reference has none (another Windows volume).
  const path = resolveAppDoctorEvidencePath(location.file, storageAnchor)
  return {
    fingerprint: finding.fingerprint,
    scope_identity: finding.scopeIdentity,
    code: finding.code,
    severity: finding.severity,
    title: finding.title,
    message: finding.message,
    location: {
      file: location.file,
      ...(path === undefined ? {} : {path}),
      ...(location.line === undefined ? {} : {line: location.line}),
      ...(location.column === undefined ? {} : {column: location.column}),
    },
    sources: [...finding.sources],
    suppressed: finding.suppressed,
    ...(suppression === undefined ? {} : {suppression: {id: suppression.id, justification: suppression.justification}}),
    fix: {
      automated: fix.automated,
      description: fix.description,
      ...(fix.guide === undefined ? {} : {guide: fix.guide}),
    },
    scoring: {eligible: finding.scoring.eligible, points: finding.scoring.points},
  }
}

/**
 * Scopes with at least one recorded result, app root first, then by directory
 * and identity. Zero-result scopes (today, an unreviewed app root) would only
 * say "nothing here"; the empty-store banner already covers the all-empty case.
 */
function toScopes(
  interpretation: AppDoctorInterpretation,
  context: AppDoctorContext,
  currentDirectories: ReadonlyMap<string, string>,
): AppDoctorStatusScope[] {
  const isAppRoot = (scope: AppDoctorStatusScope) => scope.directory_resolved && scope.directory === context.appRoot
  return interpretation.scopes
    .filter((scope) => scope.checks.length > 0)
    .map((scope) => toScope(scope, scopeDirectory(scope, currentDirectories, context.storageAnchor)))
    .sort((left, right) => {
      if (isAppRoot(left) !== isAppRoot(right)) return isAppRoot(left) ? -1 : 1
      return left.directory.localeCompare(right.directory) || left.scope_identity.localeCompare(right.scope_identity)
    })
}

function toCoverage(coverage: AppDoctorInterpretation['coverage']): AppDoctorStatusResult['coverage'] {
  return {
    static_result_count: coverage.staticResultCount,
    complete: coverage.complete,
    files_skipped: coverage.filesSkipped.length,
    unsupported_languages: coverage.unsupportedLanguages.map((language) => language.name),
    gaps: coverage.gaps.map((gap) => ({
      code: gap.code,
      message: gap.message,
      ...(gap.file === undefined ? {} : {file: gap.file}),
      ...(gap.owner === undefined
        ? {}
        : {owner: {scope_identity: gap.owner.scopeIdentity, check_id: gap.owner.checkId}}),
    })),
    owners: coverage.owners.map((owner) => ({
      scope_identity: owner.scopeIdentity,
      check_id: owner.checkId,
      files_scanned: owner.filesScanned,
      gap_count: owner.gapCount,
    })),
  }
}

function toScore(score: AppDoctorInterpretation['score']): AppDoctorStatusResult['score'] {
  if (score.status === 'graded') return {status: 'graded', total: score.total, grade: score.grade}
  return {status: 'withheld', reason: score.reason}
}

/**
 * Read the stored App Doctor results for one configuration and interpret
 * them. Nothing is printed and nothing is scanned: the result describes the
 * tree as it was when each result was recorded.
 */
export async function getAppDoctorStatus(
  options: AppDoctorStatusOptions,
  dependencies: AppDoctorStatusDependencies = defaultDependencies,
): Promise<AppDoctorStatusResult> {
  const context = await dependencies.resolveContext({
    directory: options.directory,
    configName: options.configName,
    clientId: options.clientId,
    interactive: options.interactive,
  })
  const {store, interpretation, directories} = await readStore(context)

  return {
    schema_version: 1,
    basis: interpretation.basis,
    configuration: {
      identity: context.configurationIdentity,
      path: context.configurationPath,
      name: context.configurationFileName,
      ...(context.clientId === undefined ? {} : {client_id: context.clientId}),
    },
    app_root: context.appRoot,
    store: {directory: context.storeDirectory, state: store},
    scopes: toScopes(interpretation, context, directories),
    findings: interpretation.findings.map((finding) => toFinding(finding, context.storageAnchor)),
    coverage: toCoverage(interpretation.coverage),
    score: toScore(interpretation.score),
    suppressions: {
      matched: interpretation.suppressions.matched,
      suppressed_findings: interpretation.suppressions.suppressedFindings,
      unmatched: interpretation.suppressions.unmatched.map((suppression) => ({
        id: suppression.id,
        finding_fingerprint: suppression.finding_fingerprint,
      })),
    },
    diagnostics: interpretation.diagnostics.map((diagnostic) => ({
      source: diagnostic.source,
      code: diagnostic.code,
      message: diagnostic.message,
      ...(diagnostic.path === undefined ? {} : {path: diagnostic.path}),
    })),
  }
}

/** Presenter: JSON goes to stdout exactly once; text renders banners on stderr and writes nothing to stdout. */
export function writeAppDoctorStatusResult(result: AppDoctorStatusResult, format: AppDoctorStatusFormat): void {
  if (format === 'json') {
    outputResult(appDoctorStatusJsonOutputSchema.encode(result))
    return
  }
  renderAppDoctorStatusReport(result)
}
