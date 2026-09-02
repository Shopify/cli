import {redactText} from '../rules/secret-rules.js'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionReasonCode,
  CheckExecutionStatus,
  DetectedFramework,
  DetectedSurface,
  FindingSource,
  LanguageSupport,
  Severity,
  SuppressionProvenance,
  TraceFinding,
  TraceV2,
} from '../types.js'

export const SUBMISSION_SCHEMA_VERSION = 1 as const

export interface BuildSubmissionOptions {
  cliVersion: string
  submittedAt: string
  versionTag?: string
  sourceControlUrl?: string
}

interface SubmissionFinding {
  fingerprint: string
  source: FindingSource
  severity: Severity
  title: string
  rule_id?: string
  rule_version?: number
  check_id?: string
  check_version?: number
  prompt_hash?: string
  suppressed: boolean
  suppression_id?: string
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
  prompt_hash?: string
  implementations?: SubmissionCheckImplementation[]
}

export interface AppDoctorSubmission {
  schema_version: typeof SUBMISSION_SCHEMA_VERSION
  trace_schema_version: TraceV2['schema_version']
  engine: {name: string; version: string; ruleset: string}
  cli_version: string
  generated_at: string
  submitted_at: string
  metadata: {version_tag?: string; source_control_url?: string}
  project: {dirty: boolean | null; input_hash: string}
  detection: {
    framework: DetectedFramework
    surface: DetectedSurface
    languages: {name: string; support: LanguageSupport; file_count: number}[]
  }
  findings: SubmissionFinding[]
  checks_executed: SubmissionCheck[]
  suppressions: {
    id: string
    finding_fingerprint: string
    justification: string
    provenance: {source: SuppressionProvenance['source']; created_at: string}
  }[]
  coverage: {
    files_scanned: number
    complete: boolean
    files_skipped: {too_large: number; unreadable: number}
    gaps: {code: TraceV2['coverage']['gaps'][number]['code']; check_id?: string}[]
  }
  attestation: {trace_digest: string}
}

function submissionFinding(finding: TraceFinding): SubmissionFinding {
  const common = {
    fingerprint: finding.fingerprint,
    source: finding.source,
    severity: finding.severity,
    title: redactText(finding.title),
    suppressed: finding.suppressed,
    ...(finding.suppression === undefined ? {} : {suppression_id: finding.suppression.id}),
  }

  switch (finding.source) {
    case 'agent':
      return {
        ...common,
        ...(finding.check_id === undefined ? {} : {check_id: finding.check_id}),
        ...(finding.check_version === undefined ? {} : {check_version: finding.check_version}),
        ...(finding.prompt_hash === undefined ? {} : {prompt_hash: finding.prompt_hash}),
      }
    case 'deterministic':
    case 'external':
      return {
        ...common,
        ...(finding.rule_id === undefined ? {} : {rule_id: finding.rule_id}),
        ...(finding.rule_version === undefined ? {} : {rule_version: finding.rule_version}),
      }
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
    ...(check.prompt_hash === undefined ? {} : {prompt_hash: check.prompt_hash}),
    ...(check.implementations === undefined
      ? {}
      : {implementations: check.implementations.map(submissionImplementation)}),
  }
}

function skippedFileCounts(trace: TraceV2): {too_large: number; unreadable: number} {
  return trace.coverage.files_skipped.reduce(
    (counts, file) =>
      file.reason === 'too_large'
        ? {...counts, too_large: counts.too_large + 1}
        : {...counts, unreadable: counts.unreadable + 1},
    {too_large: 0, unreadable: 0},
  )
}

export function buildSubmission(trace: TraceV2, options: BuildSubmissionOptions): AppDoctorSubmission {
  return {
    schema_version: SUBMISSION_SCHEMA_VERSION,
    trace_schema_version: trace.schema_version,
    engine: {
      name: redactText(trace.engine.name),
      version: redactText(trace.engine.version),
      ruleset: redactText(trace.engine.ruleset),
    },
    cli_version: options.cliVersion,
    generated_at: trace.generated_at,
    submitted_at: options.submittedAt,
    metadata: {
      ...(options.versionTag === undefined ? {} : {version_tag: redactText(options.versionTag)}),
      ...(options.sourceControlUrl === undefined ? {} : {source_control_url: redactText(options.sourceControlUrl)}),
    },
    project: {
      dirty: trace.project.dirty,
      input_hash: trace.project.input_hash,
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
    suppressions: trace.suppressions.map((suppression) => ({
      id: suppression.id,
      finding_fingerprint: suppression.finding_fingerprint,
      justification: redactText(suppression.justification),
      provenance: {
        source: suppression.provenance.source,
        created_at: suppression.provenance.created_at,
      },
    })),
    coverage: {
      files_scanned: trace.coverage.files_scanned,
      complete: trace.coverage.complete,
      files_skipped: skippedFileCounts(trace),
      gaps: trace.coverage.gaps.map((gap) => ({
        code: gap.code,
        ...(gap.check_id === undefined ? {} : {check_id: gap.check_id}),
      })),
    },
    attestation: {trace_digest: trace.attestation.digest},
  }
}
