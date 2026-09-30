import {redactText} from '../rules/secret-rules.js'
import type {
  AnalysisMode,
  CheckExecutionReasonCode,
  CheckExecutionStatus,
  CoverageGap,
  DetectedFramework,
  DetectedSurface,
  LanguageSupport,
  DeterministicFindingsDocument,
  DeterministicCheckExecution,
  DeterministicFinding,
  Severity,
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

interface SubmissionCheck {
  id: string
  version: number
  status: CheckExecutionStatus
  applicable: boolean
  analysis_mode: AnalysisMode
  finding_count: number
  reason_code?: CheckExecutionReasonCode
}

export interface AppSecuritySubmission {
  // Envelope keys are camelCase because Core's Apps::Management::SourceScans::Envelope reads them verbatim.
  schemaVersion: typeof SUBMISSION_SCHEMA_VERSION
  report: AppSecuritySubmissionReport
}

export interface AppSecuritySubmissionReport {
  scan_schema_version: DeterministicFindingsDocument['schema_version']
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
    files_skipped: {too_large: number; unreadable: number}
    gaps: {code: CoverageGap['code']; check_id?: string}[]
  }
}

function submissionFinding(finding: DeterministicFinding): SubmissionFinding {
  return {
    rule_id: finding.rule_id,
    rule_version: finding.rule_version,
    severity: finding.severity,
    title: redactText(finding.title),
  }
}

function submissionCheck(check: DeterministicCheckExecution): SubmissionCheck {
  return {
    id: check.id,
    version: check.version,
    status: check.status,
    applicable: check.applicable,
    analysis_mode: check.analysis_mode,
    finding_count: check.findings,
    ...(check.reason === undefined ? {} : {reason_code: check.reason.code}),
  }
}

function skippedFileCounts(deterministicFindings: DeterministicFindingsDocument): {
  too_large: number
  unreadable: number
} {
  return deterministicFindings.coverage.files_skipped.reduce(
    (counts, file) =>
      file.reason === 'too_large'
        ? {...counts, too_large: counts.too_large + 1}
        : {...counts, unreadable: counts.unreadable + 1},
    {too_large: 0, unreadable: 0},
  )
}

export function buildSubmission(
  deterministicFindings: DeterministicFindingsDocument,
  options: BuildSubmissionOptions,
): AppSecuritySubmission {
  return {
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    report: {
      scan_schema_version: deterministicFindings.schema_version,
      engine: {
        name: redactText(deterministicFindings.engine.name),
        version: redactText(deterministicFindings.engine.version),
        ruleset: redactText(deterministicFindings.engine.ruleset),
      },
      cli_version: options.cliVersion,
      generated_at: deterministicFindings.generated_at,
      submitted_at: options.submittedAt,
      // Feedback intentionally bypasses redactText; callers are responsible for the accompanying disclosure.
      feedback: options.feedback ?? null,
      metadata: {
        version_tag: options.versionTag === undefined ? null : redactText(options.versionTag),
      },
      project: {
        dirty: deterministicFindings.project.dirty,
      },
      detection: {
        framework: deterministicFindings.detection.framework,
        surface: deterministicFindings.detection.surface,
        languages: deterministicFindings.detection.languages.map((language) => ({
          name: language.name,
          support: language.support,
          file_count: language.files.length,
        })),
      },
      findings: deterministicFindings.findings.map(submissionFinding),
      checks_executed: deterministicFindings.checks_executed.map(submissionCheck),
      coverage: {
        files_scanned: deterministicFindings.coverage.files_scanned,
        files_skipped: skippedFileCounts(deterministicFindings),
        gaps: deterministicFindings.coverage.gaps.map((gap) => ({
          code: gap.code,
          ...(gap.check_id === undefined ? {} : {check_id: gap.check_id}),
        })),
      },
    },
  }
}
