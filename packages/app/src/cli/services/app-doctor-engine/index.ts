/**
 * Public App Doctor engine API.
 *
 * CLI code outside this directory should import only these operations and result
 * types: locate an app, scan, parse/compile findings, parse a stored trace,
 * build a submission, and group issues for display. Keep scanners, registries, merge helpers, and redaction
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
export {groupIssues} from './output/group-issues.js'
export type {IssueGroup} from './output/group-issues.js'
export type {Capabilities, Issue, ScanResult, Severity, TraceV2} from './types.js'
