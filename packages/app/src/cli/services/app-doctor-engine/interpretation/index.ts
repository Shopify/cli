/**
 * The single shared interpretation of recorded App Doctor evidence.
 *
 * Pure: reads validated results, the metadata inventory, and suppressions, and
 * produces plain data. Nothing here rescans, resolves paths, consults check
 * catalogues, or reads a clock; the report describes what was recorded.
 */
import {interpretAppDoctorChecks, interpretAppDoctorCoverage} from './coverage.js'
import {interpretAppDoctorFindings} from './findings.js'
import {scoreAppDoctorInterpretation} from './score.js'
import {AppDoctorInterpretationError} from './types.js'
import {canonicalJson} from '../trace/index.js'
import type {
  AppDoctorInterpretation,
  AppDoctorInterpretationInput,
  AppDoctorInterpretedCheck,
  AppDoctorInterpretedScope,
} from './types.js'
import type {AppDoctorResult, AppDoctorScopeDescriptor} from '../results/index.js'
import type {AppDoctorMetadataInventory} from '../scopes/types.js'

export {AppDoctorInterpretationError} from './types.js'
export type {
  AppDoctorAppliedSuppression,
  AppDoctorCoverageOwner,
  AppDoctorFindingScoring,
  AppDoctorImmediateDiagnostic,
  AppDoctorInterpretation,
  AppDoctorInterpretationErrorCode,
  AppDoctorInterpretationInput,
  AppDoctorInterpretedCheck,
  AppDoctorInterpretedCoverage,
  AppDoctorInterpretedCoverageGap,
  AppDoctorInterpretedCoverageOwner,
  AppDoctorInterpretedFinding,
  AppDoctorInterpretedScope,
  AppDoctorInterpretedScore,
  AppDoctorInterpretedSkippedFile,
  AppDoctorInterpretedSuppressions,
  AppDoctorInterpretedUnsupportedLanguage,
  AppDoctorModeOutcome,
  AppDoctorResultMode,
  AppDoctorScoreWithholdingReason,
} from './types.js'

/** Foreign owners and duplicate owner tuples are caller bugs, never evidence states. */
function assertOwnedResults(configurationIdentity: string, results: ReadonlyArray<AppDoctorResult>): void {
  const owners = new Set<string>()
  for (const result of results) {
    if (result.configuration_identity !== configurationIdentity) {
      throw new AppDoctorInterpretationError(
        'FOREIGN_CONFIGURATION',
        'A result belongs to a different configuration than the one being interpreted.',
      )
    }
    const owner = canonicalJson([result.scope_identity, result.check_id, result.mode])
    if (owners.has(owner)) {
      throw new AppDoctorInterpretationError('DUPLICATE_OWNER', 'Two results share one scope, check, and mode.')
    }
    owners.add(owner)
  }
}

/** Distinct descriptors in first-seen order; equality is structural. */
function distinctDescriptors(results: ReadonlyArray<AppDoctorResult>): AppDoctorScopeDescriptor[] {
  const byShape = new Map<string, AppDoctorScopeDescriptor>()
  for (const result of results) {
    const shape = canonicalJson(result.scope)
    if (!byShape.has(shape)) byShape.set(shape, result.scope)
  }
  return [...byShape.values()]
}

function interpretScopes(
  inventory: AppDoctorMetadataInventory,
  results: ReadonlyArray<AppDoctorResult>,
  checks: ReadonlyArray<AppDoctorInterpretedCheck>,
): AppDoctorInterpretedScope[] {
  const currentByIdentity = new Map(inventory.current.map((scope) => [scope.scopeIdentity, scope]))
  const identities = new Set([...currentByIdentity.keys(), ...results.map((result) => result.scope_identity)])
  return [...identities]
    .sort((left, right) => left.localeCompare(right))
    .map((scopeIdentity) => {
      const current = currentByIdentity.get(scopeIdentity)
      return {
        scopeIdentity,
        current: current !== undefined,
        ...(current === undefined ? {} : {reference: current.reference}),
        descriptors: distinctDescriptors(results.filter((result) => result.scope_identity === scopeIdentity)),
        checks: checks.filter((check) => check.scopeIdentity === scopeIdentity),
      }
    })
}

/**
 * Interpret every recorded result for one configuration. Throws
 * `AppDoctorInterpretationError` for a foreign result or a duplicate owner.
 */
export function interpretAppDoctorResults(input: AppDoctorInterpretationInput): AppDoctorInterpretation {
  assertOwnedResults(input.configurationIdentity, input.results)
  const checks = interpretAppDoctorChecks(input.results)
  const {findings, suppressions} = interpretAppDoctorFindings(input.results, input.suppressions)
  const coverage = interpretAppDoctorCoverage(input.results)
  return {
    configurationIdentity: input.configurationIdentity,
    basis: 'stored-results',
    scopes: interpretScopes(input.inventory, input.results, checks),
    checks,
    findings,
    coverage,
    score: scoreAppDoctorInterpretation(coverage, findings),
    suppressions,
    diagnostics: [...(input.diagnostics ?? [])],
  }
}
