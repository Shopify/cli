/**
 * Public App Security engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, scan, parse a stored deterministic findings,
 * build a submission, group issues for display, and validate `--ignore` patterns.
 * Keep scanners, registries, and redaction inside the engine.
 */
export {AppRootDiscoveryError, findAppRoot, getAgentInstructions, scanApp} from './run.js'
export type {AppSecurityEngineMetadata, AppSecurityScan} from './run.js'
export {
  buildDeterministicFindings,
  containsUnredactedSecret,
  parseDeterministicFindings,
} from './scan-artifact/index.js'
export type {BuildDeterministicFindingsOptions, ParseDeterministicFindingsResult} from './scan-artifact/index.js'
export {DETERMINISTIC_FINDINGS_SCHEMA_VERSION} from './types.js'
export {ignorePatternProblem} from './scanners/path-rules.js'
export {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './submission/index.js'
export type {AppSecuritySubmission, AppSecuritySubmissionReport, BuildSubmissionOptions} from './submission/index.js'
export type {AgentChecks} from './checks/index.js'
export {groupIssues} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {
  Capabilities,
  Issue,
  ProjectState,
  DeterministicFindingsDocument,
  DeterministicCheckExecution,
  DeterministicFinding,
  ScanResult,
  Severity,
} from './types.js'
