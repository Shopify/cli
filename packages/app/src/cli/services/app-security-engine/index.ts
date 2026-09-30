/**
 * Public App Security engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, scan, parse a stored trace,
 * build a submission, group issues for display, and validate `--ignore` patterns.
 * Keep scanners, registries, and redaction inside the engine.
 */
export {AppRootDiscoveryError, findAppRoot, getAgentInstructions, parseTrace, scanApp} from './run.js'
export type {AppSecurityEngineMetadata, AppSecurityScan, ParseTraceResult} from './run.js'
export {ignorePatternProblem} from './scanners/path-rules.js'
export {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './submission/index.js'
export type {AppSecuritySubmission, AppSecuritySubmissionReport, BuildSubmissionOptions} from './submission/index.js'
export type {ReviewPack} from './checks/index.js'
export {groupIssues} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {Capabilities, Issue, ScanResult, Severity, TraceV3} from './types.js'
