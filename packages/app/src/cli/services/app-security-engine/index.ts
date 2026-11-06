/**
 * Public app security check engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: read the git state, scan, record agent findings with excerpts of the files they cite, translate
 * a stored findings document (deterministic-findings.json or agent-findings.json, which share the
 * converged FindingsDocument schema), combine the two result files and the suppressions into per-check
 * results, match suppression entries against stored findings, keep the scan issues whose findings are still
 * active and group them for display, and look up which sources can report a check ID. The stored documents' Zod
 * schemas are exported too, so other schemas compose them rather than re-declare them.
 * Keep scanners, registries, validators, redaction, and the rest of the stored-schema details inside the engine.
 */
export {getAgentInstructions, getEngineVersion, scanApp} from './run.js'
export {createCitedFileReader, listGatheredPaths} from './scanners/index.js'
export {activeScanIssues} from './scan-artifact/index.js'
export {withoutCodeExcerpts} from './results/code-excerpt.js'
export type {SourceTextReader} from './results/code-excerpt.js'
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
  summarizeCombinedChecks,
} from './results/combine.js'
export type {
  CombinedCheck,
  CombinedChecksSummary,
  CombinedFinding,
  CombinedFindings,
  SourceCheckResult,
} from './results/combine.js'
export {matchSuppressionEntries} from './results/suppressions.js'
export type {
  FindingSuppression,
  LikelyFinding,
  SuppressionEntry,
  SuppressionEntryResult,
  SuppressionEntryStatus,
  SuppressionNotEvaluatedReason,
} from './results/suppressions.js'
export {recordAgentFindings} from './checks/index.js'
export {MAX_JUSTIFICATION_LENGTH, MAX_PATH_LENGTH, MAX_SNIPPET_LENGTH} from './limits.js'
export {reportingSourcesByCheckId} from './registry/index.js'
export type {AgentChecks, RecordAgentFindingsOptions, RecordAgentFindingsResult} from './checks/index.js'
export {
  AGENT_CHECKS_SCHEMA_VERSION,
  ENGINE_NAME,
  FINDINGS_SCHEMA_VERSION,
  RECORD_INPUT_SCHEMA_VERSION,
  SEVERITY_RANK,
} from './types.js'
export {groupIssues, skippedFileCounts} from './output/group-issues.js'
export {checkDocsUrl} from './rules/catalog.js'
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
  SuppressionKind,
} from './types.js'
