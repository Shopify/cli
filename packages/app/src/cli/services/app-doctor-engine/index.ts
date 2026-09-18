/**
 * Public App Doctor engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, scan, parse/compile findings, parse a stored trace, and
 * build a submission. Keep scanners, registries, merge helpers, and redaction
 * inside the engine.
 */
export {
  AppRootDiscoveryError,
  FindingsDocumentError,
  compileFindings,
  findAppRoot,
  getAgentInstructions,
  parseFindings,
  parseTrace,
  scanApp,
} from './run.js'
export type {
  AppDoctorCompile,
  AppDoctorEngineMetadata,
  AppDoctorFindings,
  AppDoctorScan,
  FindingsDocument,
  ParseTraceResult,
} from './run.js'
export {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './submission/index.js'
export type {AppDoctorSubmission, AppDoctorSubmissionReport, BuildSubmissionOptions} from './submission/index.js'
export type {ReviewPack} from './checks/index.js'
export type {Capabilities, Issue, ScanResult, Severity, TraceV2} from './types.js'
export {
  APP_DOCTOR_RESULT_SCHEMA_VERSION,
  APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION,
  AppDoctorResultError,
  FINDING_IDENTITY_VERSION,
  computeAppDoctorFindingFingerprint,
  createAppDoctorResult,
  formatAppDoctorEvidencePath,
  getAppDoctorResultOutcome,
  parseAppDoctorResult,
  parseAppDoctorScopeDescriptor,
  serializeAppDoctorResult,
} from './results/index.js'
export type {
  AppDoctorAgentResult,
  AppDoctorFinding,
  AppDoctorFindingIdentity,
  AppDoctorFindingInput,
  AppDoctorFindingKey,
  AppDoctorPathReference,
  AppDoctorResult,
  AppDoctorResultInput,
  AppDoctorResultOutcome,
  AppDoctorResultOwner,
  AppDoctorScopeDescriptor,
  AppDoctorStaticResult,
  ParseAppDoctorResult,
  ParseAppDoctorScopeDescriptor,
} from './results/index.js'
export {AppDoctorContextError} from './context/types.js'
export type {
  AppDoctorApp,
  AppDoctorConfiguration,
  AppDoctorConfigurationDecision,
  AppDoctorConfigurationSelection,
  AppDoctorContext,
  AppDoctorContextErrorCode,
  AppDoctorDiscovery,
  AppDoctorSelectionOptions,
} from './context/types.js'
export {discoverAppDoctorApps} from './context/discovery.js'
export {selectAppDoctorApp, selectAppDoctorConfiguration} from './context/selection.js'
export {inspectAppDoctorConfigurations} from './context/configurations.js'
export {createAppDoctorContext} from './context/context.js'
export {AppDoctorScopeError} from './scopes/types.js'
export type {
  AppDoctorCurrentScope,
  AppDoctorMetadataInventory,
  AppDoctorRetainedScopeObservation,
  AppDoctorReviewScope,
  AppDoctorScopeErrorCode,
} from './scopes/types.js'
export {
  appDoctorScopeIdentity,
  projectAppDoctorEvidencePath,
  projectAppDoctorPath,
  resolveAppDoctorEvidencePath,
  resolveAppDoctorScopeDirectory,
} from './scopes/paths.js'
export type {ScopePathFlavor} from './scopes/paths.js'
export {buildAppDoctorReviewScopes} from './scopes/review.js'
export type {AppDoctorReviewScopeOptions} from './scopes/review.js'
export {buildAppDoctorMetadataInventory} from './scopes/inventory.js'
export {enumerateAppDoctorResults, readAppDoctorResults, replaceAppDoctorResults} from './store/results.js'
export {editAppDoctorSuppressions, readAppDoctorSuppressions} from './store/suppressions.js'
export type {
  AppDoctorPreviousData,
  AppDoctorPublicationReceipt,
  AppDoctorResultBatch,
  AppDoctorResultKey,
  AppDoctorResultRead,
  AppDoctorResultReceipt,
  AppDoctorStoreDiagnostic,
  AppDoctorStoreErrorCode,
  AppDoctorStoreOptions,
  AppDoctorSuppressionDocument,
  AppDoctorSuppressionEdit,
  AppDoctorSuppressionEditResult,
  AppDoctorSuppressionRead,
  AppDoctorWriterMode,
} from './store/types.js'
export {AppDoctorInterpretationError, interpretAppDoctorResults} from './interpretation/index.js'
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
} from './interpretation/index.js'
export {loadChecks} from './checks/index.js'
export type {Check} from './checks/index.js'
export {ENGINE_NAME} from './types.js'
export {getEngineVersion} from './version.js'
export {
  APP_DOCTOR_REVIEW_BINDING_VERSION,
  AppDoctorReviewBindingError,
  decodeAppDoctorReviewBinding,
  encodeAppDoctorReviewBinding,
} from './review/binding.js'
export type {AppDoctorReviewBinding, AppDoctorReviewBindingErrorCode} from './review/binding.js'
export {
  APP_DOCTOR_AGENT_FINDINGS_SCHEMA_VERSION,
  AppDoctorAgentFindingsError,
  describeAppDoctorAgentFindingsDocument,
  parseAppDoctorAgentFindingsDocument,
} from './review/findings.js'
export type {
  AppDoctorAgentCheck,
  AppDoctorAgentCheckOutcome,
  AppDoctorAgentFindingInput,
  AppDoctorAgentFindingsDocument,
} from './review/findings.js'
export {prepareAppDoctorRecord} from './review/record.js'
export type {
  AppDoctorRecordInput,
  AppDoctorRecordPreparation,
  AppDoctorRecordProblem,
  AppDoctorRecordProblemCode,
  AppDoctorRecordScope,
  AppDoctorRecordSubmission,
} from './review/record.js'
export {buildAppDoctorInstructions} from './review/instructions.js'
export type {
  AppDoctorInstructions,
  AppDoctorInstructionsCheck,
  AppDoctorInstructionsCommand,
  AppDoctorInstructionsInput,
  AppDoctorInstructionsScope,
} from './review/instructions.js'
