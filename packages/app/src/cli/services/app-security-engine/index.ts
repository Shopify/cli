/**
 * Public App Security engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, read its git state, scan, record agent findings, translate
 * a stored findings document (deterministic-findings.json or agent-findings.json, which share the
 * converged FindingsDocument schema), combine the two result files into per-check results, build a
 * submission, group issues for display, and validate `--ignore` patterns. The stored documents' Zod
 * schemas are exported too, so the public `review --json` schema is composed from them rather than re-declared.
 * Keep scanners, registries, validators, redaction, and the rest of the stored-schema details inside the engine.
 */
export {
  AppRootDiscoveryError,
  findAppRoot,
  getAgentInstructions,
  getEngineVersion,
  readProjectState,
  scanApp,
} from './run.js'
export type {AppSecurityEngineMetadata, AppSecurityScan} from './run.js'
export {containsUnredactedSecret} from './scan-artifact/index.js'
export {translateFindingsDocument} from './results/translate.js'
export type {TranslateFindingsDocumentResult} from './results/translate.js'
export {
  agentFindingsDocumentSchema,
  checkPrecedenceSchema,
  checkStatusSchema,
  coverageSchema,
  deterministicFindingsDocumentSchema,
  projectDetectionSchema,
  projectStateSchema,
  severitySchema,
  storedCheckSchema,
  storedFindingSchema,
} from './results/schema.js'
export type {Equals} from './results/schema.js'
export {
  activeFindings,
  combineFindings,
  isAgentResultStale,
  isCheckPassed,
  isSuppressed,
  summarizeCombinedChecks,
} from './results/combine.js'
export type {CombinedCheck, CombinedChecksSummary, CombinedFinding, SourceCheckResult} from './results/combine.js'
export {recordAgentFindings} from './checks/index.js'
export type {AgentChecks, RecordAgentFindingsOptions, RecordAgentFindingsResult} from './checks/index.js'
export {
  AGENT_CHECKS_SCHEMA_VERSION,
  ENGINE_NAME,
  FINDINGS_SCHEMA_VERSION,
  RECORD_INPUT_SCHEMA_VERSION,
  SEVERITY_RANK,
} from './types.js'
export {ignorePatternProblem} from './scanners/path-rules.js'
export {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './submission/index.js'
export type {AppSecuritySubmission, BuildSubmissionOptions, BuildSubmissionSources} from './submission/index.js'
export {groupIssues, skippedFileCounts} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {
  AgentFindingsDocument,
  Capabilities,
  CheckPrecedence,
  CheckSnapshot,
  DeterministicFindingsDocument,
  FindingsDocument,
  FindingsSource,
  Issue,
  ProjectState,
  ScanResult,
  Severity,
  StoredCheck,
  StoredCheckStatus,
  StoredEvidence,
  StoredFinding,
} from './types.js'
