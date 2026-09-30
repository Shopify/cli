import {redactText} from '../rules/secret-rules.js'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionReasonCode,
  CheckExecutionStatus,
  DetectedFramework,
  DetectedSurface,
  LanguageSupport,
  Severity,
  TraceFinding,
  TraceV3,
} from '../types.js'

export const SUBMISSION_SCHEMA_VERSION = 0 as const

export interface BuildSubmissionOptions {
  cliVersion: string
  submittedAt: string
  versionTag?: string
  feedback?: string
}

interface SubmissionFinding {
  rule_id: string
  rule_version: number
  severity: Severity
  title: string
}

interface SubmissionCheckImplementation {
  id: string
  analysis_mode: AnalysisMode
  status: CheckExecutionStatus
  finding_count: number
  inspected_file_count: number
  reason_code?: CheckExecutionReasonCode
}

interface SubmissionCheck {
  id: string
  version: number
  kind: CheckExecution['kind']
  status: CheckExecutionStatus
  required: boolean
  applicable: boolean
  analysis_mode: AnalysisMode
  finding_count: number
  inspected_file_count: number
  reason_code?: CheckExecutionReasonCode
  implementations?: SubmissionCheckImplementation[]
}

export interface AppSecuritySubmission {
  // Envelope keys are camelCase because Core's Apps::Management::SourceScans::Envelope reads them verbatim.
  schemaVersion: typeof SUBMISSION_SCHEMA_VERSION
  report: AppSecuritySubmissionReport
}

export interface AppSecuritySubmissionReport {
  trace_schema_version: TraceV3['schema_version']
  engine: {name: string; version: string; ruleset: string}
  cli_version: string
  generated_at: string
  submitted_at: string
  feedback: string | null
  // Always-applicable slots use null when unavailable (like project.commit); variant-dependent fields are omitted.
  metadata: {version_tag: string | null}
  project: {dirty: boolean | null}
  detection: {
    framework: DetectedFramework
    surface: DetectedSurface
    languages: {name: string; support: LanguageSupport; file_count: number}[]
  }
  findings: SubmissionFinding[]
  checks_executed: SubmissionCheck[]
  coverage: {
    files_scanned: number
    complete: boolean
    files_skipped: {too_large: number; unreadable: number}
    gaps: {code: TraceV3['coverage']['gaps'][number]['code']; check_id?: string}[]
  }
}

function submissionFinding(finding: TraceFinding): SubmissionFinding {
  return {
    rule_id: finding.rule_id,
    rule_version: finding.rule_version,
    severity: finding.severity,
    title: redactText(finding.title),
  }
}

function submissionImplementation(
  implementation: NonNullable<CheckExecution['implementations']>[number],
): SubmissionCheckImplementation {
  return {
    id: implementation.id,
    analysis_mode: implementation.analysis_mode,
    status: implementation.status,
    finding_count: implementation.findings,
    inspected_file_count: implementation.inspected_files.length,
    ...(implementation.reason === undefined ? {} : {reason_code: implementation.reason.code}),
  }
}

function submissionCheck(check: CheckExecution): SubmissionCheck {
  return {
    id: check.id,
    version: check.version,
    kind: check.kind,
    status: check.status,
    required: check.required,
    applicable: check.applicable,
    analysis_mode: check.analysis_mode,
    finding_count: check.findings,
    inspected_file_count: check.inspected_files.length,
    ...(check.reason === undefined ? {} : {reason_code: check.reason.code}),
    ...(check.implementations === undefined
      ? {}
      : {implementations: check.implementations.map(submissionImplementation)}),
  }
}

function skippedFileCounts(trace: TraceV3): {too_large: number; unreadable: number} {
  return trace.coverage.files_skipped.reduce(
    (counts, file) =>
      file.reason === 'too_large'
        ? {...counts, too_large: counts.too_large + 1}
        : {...counts, unreadable: counts.unreadable + 1},
    {too_large: 0, unreadable: 0},
  )
}

export function buildSubmission(trace: TraceV3, options: BuildSubmissionOptions): AppSecuritySubmission {
  return {
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    report: {
      trace_schema_version: trace.schema_version,
      engine: {
        name: redactText(trace.engine.name),
        version: redactText(trace.engine.version),
        ruleset: redactText(trace.engine.ruleset),
      },
      cli_version: options.cliVersion,
      generated_at: trace.generated_at,
      submitted_at: options.submittedAt,
      // Feedback intentionally bypasses redactText; callers are responsible for the accompanying disclosure.
      feedback: options.feedback ?? null,
      metadata: {
        version_tag: options.versionTag === undefined ? null : redactText(options.versionTag),
      },
      project: {
        dirty: trace.project.dirty,
      },
      detection: {
        framework: trace.detection.framework,
        surface: trace.detection.surface,
        languages: trace.detection.languages.map((language) => ({
          name: language.name,
          support: language.support,
          file_count: language.files.length,
        })),
      },
      findings: trace.findings.map(submissionFinding),
      checks_executed: trace.checks_executed.map(submissionCheck),
      coverage: {
        files_scanned: trace.coverage.files_scanned,
        complete: trace.coverage.complete,
        files_skipped: skippedFileCounts(trace),
        gaps: trace.coverage.gaps.map((gap) => ({
          code: gap.code,
          ...(gap.check_id === undefined ? {} : {check_id: gap.check_id}),
        })),
      },
    },
  }
}
