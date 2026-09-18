/**
 * Interpretation report contract.
 *
 * An interpretation is a pure reading of recorded evidence: stored results, the
 * metadata inventory, and suppressions. It never rescans, never touches the
 * filesystem or clock, and makes no claim about the present tree.
 */
import type {
  AppDoctorFinding,
  AppDoctorPathReference,
  AppDoctorResult,
  AppDoctorResultOutcome,
  AppDoctorScopeDescriptor,
  AppDoctorStaticResult,
} from '../results/index.js'
import type {AppDoctorMetadataInventory} from '../scopes/types.js'
import type {Grade, Suppression} from '../types.js'

export type AppDoctorResultMode = AppDoctorResult['mode']

/** A diagnostic raised by the operation that produced the inputs; passed through and never persisted. */
export interface AppDoctorImmediateDiagnostic {
  readonly source: 'store' | 'record' | 'scan'
  readonly code: string
  readonly message: string
  readonly path?: string
}

export interface AppDoctorInterpretationInput {
  readonly configurationIdentity: string
  /** Validated current results from the store, in any modes and for any owners. */
  readonly results: ReadonlyArray<AppDoctorResult>
  readonly inventory: AppDoctorMetadataInventory
  readonly suppressions: ReadonlyArray<Suppression>
  readonly diagnostics?: ReadonlyArray<AppDoctorImmediateDiagnostic>
}

export type AppDoctorInterpretationErrorCode = 'FOREIGN_CONFIGURATION' | 'DUPLICATE_OWNER'

/**
 * Raised for caller bugs only: a result for another configuration or two
 * results for one owner tuple. Evidence states are never errors.
 *
 * A plain `Error` rather than a cli-kit `AbortError`: the engine is a library
 * boundary and callers decide how to surface failures.
 */
export class AppDoctorInterpretationError extends Error {
  constructor(
    readonly code: AppDoctorInterpretationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppDoctorInterpretationError'
  }
}

type ExecutionReason = NonNullable<AppDoctorResult['execution']['reason']>

/** The outcome of one mode for one (scope, check). Absence is `not_run`, never "passed". */
export type AppDoctorModeOutcome =
  | {readonly outcome: 'not_run'}
  | {
      readonly outcome: Exclude<AppDoctorResultOutcome, 'not_run'>
      readonly producedAt: string
      readonly checkVersion: number
      readonly findingCount: number
      readonly reason?: ExecutionReason
      readonly guidance?: string
      /** Agent results only. */
      readonly promptHash?: string
    }

export interface AppDoctorInterpretedCheck {
  readonly scopeIdentity: string
  readonly checkId: string
  readonly static: AppDoctorModeOutcome
  readonly agent: AppDoctorModeOutcome
}

export interface AppDoctorInterpretedScope {
  readonly scopeIdentity: string
  /** True when the scope is in `inventory.current`. */
  readonly current: boolean
  /** From the current inventory entry, when there is one. */
  readonly reference?: AppDoctorPathReference
  /** Every distinct descriptor observed on results for this scope; none is chosen as a winner. */
  readonly descriptors: ReadonlyArray<AppDoctorScopeDescriptor>
  readonly checks: ReadonlyArray<AppDoctorInterpretedCheck>
}

export interface AppDoctorFindingScoring {
  readonly eligible: boolean
  readonly points: number
}

export interface AppDoctorAppliedSuppression {
  readonly id: Suppression['id']
  readonly justification: Suppression['justification']
  readonly provenance: Suppression['provenance']
}

export interface AppDoctorInterpretedFinding {
  readonly fingerprint: string
  readonly scopeIdentity: string
  readonly code: string
  /** The highest severity across observations. */
  readonly severity: AppDoctorFinding['severity']
  readonly title: string
  readonly message: string
  readonly location: AppDoctorFinding['location']
  readonly snippet?: string
  readonly fix: AppDoctorFinding['fix']
  readonly evidence: AppDoctorFinding['evidence']
  /** Modes that observed this finding, static first. */
  readonly sources: ReadonlyArray<AppDoctorResultMode>
  readonly observations: {readonly static?: AppDoctorFinding; readonly agent?: AppDoctorFinding}
  readonly scoring: AppDoctorFindingScoring
  /** Suppression hides presentation only; `scoring` is unaffected. */
  readonly suppressed: boolean
  readonly suppression?: AppDoctorAppliedSuppression
}

type StaticCoverage = AppDoctorStaticResult['coverage']

export type AppDoctorInterpretedSkippedFile = StaticCoverage['files_skipped'][number]
export type AppDoctorInterpretedUnsupportedLanguage = StaticCoverage['unsupported_languages'][number]

export interface AppDoctorCoverageOwner {
  readonly scopeIdentity: string
  readonly checkId: string
}

export interface AppDoctorInterpretedCoverageGap {
  readonly code: StaticCoverage['gaps'][number]['code']
  readonly message: string
  readonly file?: string
  /** Present only on owner-local `unresolved_check` gaps; scan-wide gaps are deduplicated across owners. */
  readonly owner?: AppDoctorCoverageOwner
}

export interface AppDoctorInterpretedCoverageOwner extends AppDoctorCoverageOwner {
  /** Per owner only. Every static result reports the same scan-wide count, so summing would multiply it. */
  readonly filesScanned: number
  readonly gapCount: number
}

export interface AppDoctorInterpretedCoverage {
  readonly staticResultCount: number
  /** True only when static results exist and none reports a gap. */
  readonly complete: boolean
  readonly filesSkipped: ReadonlyArray<AppDoctorInterpretedSkippedFile>
  readonly unsupportedLanguages: ReadonlyArray<AppDoctorInterpretedUnsupportedLanguage>
  readonly gaps: ReadonlyArray<AppDoctorInterpretedCoverageGap>
  readonly owners: ReadonlyArray<AppDoctorInterpretedCoverageOwner>
}

export type AppDoctorScoreWithholdingReason = 'no_static_results' | 'incomplete_static_coverage'

export type AppDoctorInterpretedScore =
  | {readonly status: 'graded'; readonly total: number; readonly baseline: 100; readonly grade: Grade}
  | {readonly status: 'withheld'; readonly reason: AppDoctorScoreWithholdingReason}

export interface AppDoctorInterpretedSuppressions {
  /** Number of suppressions whose fingerprint matched a finding; several may match one finding. */
  readonly matched: number
  /** Number of findings marked `suppressed`; at most one suppression attaches per finding. */
  readonly suppressedFindings: number
  /** Suppressions whose fingerprint matched no finding, kept so they can be reported rather than dropped. */
  readonly unmatched: ReadonlyArray<Suppression>
}

export interface AppDoctorInterpretation {
  readonly configurationIdentity: string
  /** This is a reading of recorded evidence: no rescan, no claim about the present tree. */
  readonly basis: 'stored-results'
  readonly scopes: ReadonlyArray<AppDoctorInterpretedScope>
  readonly checks: ReadonlyArray<AppDoctorInterpretedCheck>
  readonly findings: ReadonlyArray<AppDoctorInterpretedFinding>
  readonly coverage: AppDoctorInterpretedCoverage
  readonly score: AppDoctorInterpretedScore
  readonly suppressions: AppDoctorInterpretedSuppressions
  readonly diagnostics: ReadonlyArray<AppDoctorImmediateDiagnostic>
}
