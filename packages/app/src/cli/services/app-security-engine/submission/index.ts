import {redactText} from '../rules/secret-rules.js'
import {checkGeneratedAt, isSuppressed} from '../results/combine.js'
import {FINDINGS_SCHEMA_VERSION} from '../types.js'
import type {
  AgentFindingsDocument,
  AnalysisMode,
  CheckPrecedence,
  CoverageGap,
  DetectedFramework,
  DetectedSurface,
  DeterministicFindingsDocument,
  FindingsDocument,
  FindingsSource,
  LanguageSupport,
  Severity,
  SkippedFile,
  StoredCheck,
  StoredCheckStatus,
  StoredFinding,
} from '../types.js'

/**
 * The upload payload (§10.2). Version 2 sends both stored result files, projected through one allow-list.
 * `main` is at 1; the base branch set 0 deliberately so the server would reject it.
 *
 * The server recomputes the combination (`combineFindings`) from this payload, so every combination input is
 * projected under the same rule `review` applies: `suppressed` follows `isSuppressed`, `snapshot.precedence` is
 * sent for agent documents only, and each check carries the time its source recorded it (`generated_at`) so the
 * server can apply the same staleness rule — a `prefer-agent` agent result older than the deterministic result
 * falls back to union.
 */
export const SUBMISSION_SCHEMA_VERSION = 2 as const

export interface BuildSubmissionOptions {
  cliVersion: string
  submittedAt: string
  versionTag?: string
  feedback?: string
}

/** The present result files. At least one must be non-null. */
export interface BuildSubmissionSources {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}

/** Only the inputs the combination uses. Free text (message, evidence, reasoning, justification) stays out. */
export interface SubmissionFinding {
  confidence?: StoredFinding['confidence']
  suppressed: boolean
}

export interface SubmissionCheckSnapshot {
  title: string
  severity: Severity
  current_version: number
  /** Agent documents only. */
  precedence?: CheckPrecedence
}

export interface SubmissionCheck {
  id: string
  version: number
  status: StoredCheckStatus
  /** Deterministic only: the agent's reason code is free text, so the agent filter drops it. */
  reason_code?: string
  /** Deterministic only. */
  analysis_mode?: AnalysisMode
  /** ISO time the source recorded the check: the same input the combination's staleness rule uses. */
  generated_at: string
  snapshot: SubmissionCheckSnapshot
  findings: SubmissionFinding[]
}

export interface SubmissionDetection {
  framework: DetectedFramework
  surface: DetectedSurface
  languages: {name: string; support: LanguageSupport; file_count: number}[]
}

/** How many files the deterministic scan skipped, by reason. */
export interface SkippedFileCounts {
  too_large: number
  unreadable: number
}

export interface SubmissionCoverage {
  files_scanned: number
  files_skipped: SkippedFileCounts
  gaps: {code: CoverageGap['code']; check_id?: string}[]
}

/** One stored result file, projected for upload. */
export interface SubmissionSourcePayload {
  schema_version: typeof FINDINGS_SCHEMA_VERSION
  source: FindingsSource
  engine: {name: string; version: string; ruleset?: string}
  generated_at: string
  /** The commit is excluded. */
  project: {dirty: boolean | null}
  checks: SubmissionCheck[]
  /** Deterministic only. */
  detection?: SubmissionDetection
  /** Deterministic only. */
  coverage?: SubmissionCoverage
}

export interface AppSecuritySubmission {
  // Envelope keys are camelCase because Core's Apps::Management::SourceScans::Envelope reads them verbatim.
  schemaVersion: typeof SUBMISSION_SCHEMA_VERSION
  report: AppSecuritySubmissionReport
}

export interface AppSecuritySubmissionReport {
  cli_version: string
  submitted_at: string
  /** Sent without redaction: the command discloses this before uploading. */
  feedback: string | null
  metadata: {version_tag: string | null}
  /** At least one source is non-null. */
  sources: {deterministic: SubmissionSourcePayload | null; agent: SubmissionSourcePayload | null}
}

function submissionFinding(finding: StoredFinding, source: FindingsSource): SubmissionFinding {
  return {
    ...(finding.confidence === undefined ? {} : {confidence: finding.confidence}),
    suppressed: isSuppressed(finding, source),
  }
}

/**
 * Check IDs, reason codes and gap check IDs are catalog IDs and enum values when `check` writes them, which the
 * redactor leaves untouched; redacting them anyway means a hand-edited file can't smuggle a secret through.
 * Precedence is read from agent documents only, as the combination does.
 */
function submissionCheck(check: StoredCheck, document: FindingsDocument): SubmissionCheck {
  const {source} = document
  const isDeterministic = source === 'deterministic'
  const precedence = source === 'agent' ? check.snapshot.precedence : undefined
  return {
    id: redactText(check.id),
    version: check.version,
    status: check.status,
    ...(isDeterministic && check.reason !== undefined ? {reason_code: redactText(check.reason.code)} : {}),
    ...(isDeterministic && check.analysis_mode !== undefined ? {analysis_mode: check.analysis_mode} : {}),
    generated_at: checkGeneratedAt(check, document),
    snapshot: {
      title: redactText(check.snapshot.title),
      severity: check.snapshot.severity,
      current_version: check.snapshot.current_version,
      ...(precedence === undefined ? {} : {precedence}),
    },
    findings: check.findings.map((finding) => submissionFinding(finding, source)),
  }
}

function submissionDetection(document: DeterministicFindingsDocument): SubmissionDetection {
  return {
    framework: document.detection.framework,
    surface: document.detection.surface,
    languages: document.detection.languages.map((language) => ({
      name: language.name,
      support: language.support,
      file_count: language.files.length,
    })),
  }
}

export function skippedFileCounts(files: SkippedFile[]): SkippedFileCounts {
  return {
    too_large: files.filter((file) => file.reason === 'too_large').length,
    unreadable: files.filter((file) => file.reason === 'unreadable').length,
  }
}

function submissionCoverage(document: DeterministicFindingsDocument): SubmissionCoverage {
  return {
    files_scanned: document.coverage.files_scanned,
    files_skipped: skippedFileCounts(document.coverage.files_skipped),
    gaps: document.coverage.gaps.map((gap) => ({
      code: gap.code,
      ...(gap.check_id === undefined ? {} : {check_id: redactText(gap.check_id)}),
    })),
  }
}

/**
 * The one projection from a stored document to its upload shape. It's an allow-list: every field is copied
 * by name so nothing new in a stored document can reach the payload unnoticed. The deterministic-only fields
 * and the agent filter both follow from `document.source`.
 */
function sourcePayload(document: FindingsDocument): SubmissionSourcePayload {
  const engine = {
    name: redactText(document.engine.name),
    version: redactText(document.engine.version),
    ...(document.source === 'deterministic' ? {ruleset: redactText(document.engine.ruleset)} : {}),
  }
  return {
    schema_version: FINDINGS_SCHEMA_VERSION,
    source: document.source,
    engine,
    generated_at: document.generated_at,
    project: {dirty: document.project.dirty},
    checks: document.checks.map((check) => submissionCheck(check, document)),
    ...(document.source === 'deterministic'
      ? {detection: submissionDetection(document), coverage: submissionCoverage(document)}
      : {}),
  }
}

export function buildSubmission(
  sources: BuildSubmissionSources,
  options: BuildSubmissionOptions,
): AppSecuritySubmission {
  if (sources.deterministic === null && sources.agent === null) {
    // The caller checks for the no-results state first, so reaching this is a programming error.
    throw new Error('buildSubmission needs at least one findings document.')
  }
  return {
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    report: {
      cli_version: options.cliVersion,
      submitted_at: options.submittedAt,
      // Feedback intentionally bypasses redactText; callers are responsible for the accompanying disclosure.
      feedback: options.feedback ?? null,
      metadata: {
        version_tag: options.versionTag === undefined ? null : redactText(options.versionTag),
      },
      sources: {
        deterministic: sources.deterministic === null ? null : sourcePayload(sources.deterministic),
        agent: sources.agent === null ? null : sourcePayload(sources.agent),
      },
    },
  }
}
