export {scan, DETERMINISTIC_CHECKS, DETERMINISTIC_RULES} from './scanners/index.js'
export type {DeterministicCheckDefinition} from './scanners/index.js'
export {
  buildReviewPack,
  loadChecks,
  mergeFindings,
  validateFinding,
  validateAgentChecksExecuted,
} from './checks/index.js'
export type {AgentFinding, AgentFindingsDocument, Check, ReviewPack} from './checks/index.js'
export {assertRegistryInvariants, getRegistry} from './registry/index.js'
export type {RegistryEntry} from './registry/index.js'
export {
  compileTrace,
  validateTrace,
  validateSuppression,
  assertCompatibleTrace,
  isTraceSchemaVersionSupported,
  canonicalJson,
  findingFingerprint,
  sha256,
} from './trace/index.js'
export type {CompileTraceOptions, TraceValidationResult} from './trace/index.js'
export {mergeExternalFindings, validateExternalFinding} from './external/index.js'
export type {ExternalFinding} from './external/index.js'
export {formatConsole, formatIssue, formatJson, sortIssues} from './output/format.js'
export {ENGINE_NAME, SUPPORTED_TRACE_SCHEMA_VERSIONS, TRACE_SCHEMA_VERSION} from './types.js'
export {getEngineVersion} from './version.js'
export type {
  AnalysisMode,
  Capabilities,
  CheckExecution,
  CheckExecutionReason,
  CheckExecutionStatus,
  Confidence,
  CoverageGap,
  DetectedFramework,
  DetectedLanguage,
  DetectedSurface,
  FindingEvidence,
  FindingSource,
  Fix,
  Grade,
  Issue,
  Location,
  ScanMetadata,
  ScanResult,
  ScoreResult,
  Severity,
  SkippedFile,
  Suppression,
  SuppressionProvenance,
  TraceFinding,
  TraceV1,
  TraceV2,
} from './types.js'
