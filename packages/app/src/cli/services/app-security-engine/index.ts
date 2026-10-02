/**
 * Public App Security engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: read the git state, scan, record agent findings, translate
 * a stored findings document (deterministic-findings.json or agent-findings.json, which share the
 * converged FindingsDocument schema), combine the two result files into per-check results, group
 * issues for display. The stored documents' Zod
 * schemas are exported too, so the public `review --json` schema is composed from them rather than re-declared.
 * Keep scanners, registries, validators, redaction, and the rest of the stored-schema details inside the engine.
 */
export {getAgentInstructions, getEngineVersion, scanApp} from './run.js'
export {listGatheredPaths} from './scanners/index.js'
export type {AppSecurityEngineMetadata, AppSecurityScan} from './run.js'
export {translateFindingsDocument} from './results/translate.js'
export type {TranslateFindingsDocumentResult} from './results/translate.js'
export {
  agentFindingsDocumentSchema,
  checkPrecedenceSchema,
  checkStatusSchema,
  coverageSchema,
  deterministicFindingsDocumentSchema,
  projectDetectionSchema,
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
export {groupIssues, skippedFileCounts} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {
  AgentFindingsDocument,
  AppSecurityScope,
  Capabilities,
  CheckPrecedence,
  CheckSnapshot,
  CoverageScanDirectory,
  DeterministicFindingsDocument,
  FindingsDocument,
  FindingsSource,
  Issue,
  ScanInput,
  ScanOptions,
  ScanResult,
  Severity,
  StoredCheck,
  StoredCheckStatus,
  StoredEvidence,
  StoredFinding,
} from './types.js'
