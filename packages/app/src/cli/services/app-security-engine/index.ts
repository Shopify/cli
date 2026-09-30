/**
 * Public App Security engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, read its git state, scan, record agent findings, parse a
 * stored deterministic findings, build a submission, group issues for display, and validate
 * `--ignore` patterns. Keep scanners, registries, validators, and redaction inside the engine.
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
export {
  buildDeterministicFindings,
  containsUnredactedSecret,
  parseDeterministicFindings,
} from './scan-artifact/index.js'
export type {BuildDeterministicFindingsOptions, ParseDeterministicFindingsResult} from './scan-artifact/index.js'
export {recordAgentFindings} from './checks/index.js'
export type {AgentChecks, RecordAgentFindingsOptions, RecordAgentFindingsResult} from './checks/index.js'
export {
  AGENT_CHECKS_SCHEMA_VERSION,
  AGENT_FINDINGS_SCHEMA_VERSION,
  RECORD_INPUT_SCHEMA_VERSION,
  DETERMINISTIC_FINDINGS_SCHEMA_VERSION,
} from './types.js'
export {ignorePatternProblem} from './scanners/path-rules.js'
export {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './submission/index.js'
export type {AppSecuritySubmission, AppSecuritySubmissionReport, BuildSubmissionOptions} from './submission/index.js'
export {groupIssues} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {
  AgentCheckReason,
  AgentCheckSnapshot,
  AgentCheckStatus,
  AgentFindingEvidence,
  AgentFindingsArtifact,
  AgentFindingsCheck,
  AgentFindingsFinding,
  Capabilities,
  Issue,
  ProjectState,
  DeterministicFindingsDocument,
  DeterministicCheckExecution,
  DeterministicFinding,
  ScanResult,
  Severity,
} from './types.js'
