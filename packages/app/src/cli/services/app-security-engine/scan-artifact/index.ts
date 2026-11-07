import {ENGINE_NAME, FINDINGS_SCHEMA_VERSION} from '../types.js'
import {redactScope, redactText} from '../rules/secret-rules.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {compareFindingLocations, compareStrings} from '../results/order.js'
import type {
  AppSecurityScope,
  CheckExecution,
  CoverageScanDirectory,
  CheckSnapshot,
  DeterministicFindingsDocument,
  FindingEvidence,
  Issue,
  Location,
  ScanResult,
  StoredCheck,
  StoredCheckStatus,
  StoredFinding,
} from '../types.js'

const safeLocation = (location: Location): Location => ({
  file: redactText(location.file.replace(/\\/g, '/')),
  ...(location.line === undefined ? {} : {line: location.line}),
  ...(location.column === undefined ? {} : {column: location.column}),
})

const redactEvidence = (evidence: FindingEvidence[] | undefined): FindingEvidence[] =>
  (evidence ?? []).map((item) => ({
    location: safeLocation(item.location),
    ...(item.quote === undefined ? {} : {quote: redactText(item.quote)}),
  }))

export function redactIssue(issue: Issue): Issue {
  return {
    ...issue,
    id: redactText(issue.id),
    title: redactText(issue.title),
    message: redactText(issue.message),
    location: safeLocation(issue.location),
    ...(issue.snippet === undefined ? {} : {snippet: redactText(issue.snippet)}),
    ...(issue.detection_evidence === undefined ? {} : {detection_evidence: issue.detection_evidence.map(redactText)}),
    ...(issue.evidence === undefined ? {} : {evidence: redactEvidence(issue.evidence)}),
    fix: {
      ...issue.fix,
      description: redactText(issue.fix.description),
      ...(issue.fix.guide ? {guide: redactText(issue.fix.guide)} : {}),
    },
  }
}

/** The stored finding: the issue's own severity and title are dropped, because the check's snapshot carries them. */
function issueToFinding(issueInput: Issue): StoredFinding {
  // redactIssue has already redacted the evidence.
  const issue = redactIssue(issueInput)
  return {
    location: issue.location,
    message: issue.message,
    evidence: issue.evidence ?? [],
    ...(issue.snippet === undefined ? {} : {snippet: issue.snippet}),
    fix: issue.fix,
  }
}

/** Findings are already grouped under one check, so location then message is a total order. */
function compareStoredFindings(left: StoredFinding, right: StoredFinding): number {
  return compareFindingLocations(left, right) || compareStrings(left.message, right.message)
}

/** `unsupported_framework` is a way of being unresolved; the reason code already says which. */
function storedStatus(status: CheckExecution['status']): StoredCheckStatus {
  return status === 'unsupported_framework' ? 'unresolved' : status
}

/** Check metadata from the catalog right now, so the document can be displayed without it later. */
function snapshotDeterministicCheck(execution: CheckExecution): CheckSnapshot {
  // registry/index.ts guarantees every deterministic check has a catalog entry ("Orphan deterministic runner").
  const entry = RULE_CATALOG.find((catalogEntry) => catalogEntry.id === execution.id)
  if (!entry) throw new Error(`Deterministic check has no catalog entry: ${execution.id}`)
  return {
    title: entry.title,
    severity: entry.severity,
    description: entry.description,
    ...(entry.guide ? {guide: entry.guide} : {}),
    docs_url: entry.docsUrl,
    current_version: execution.version,
  }
}

function storedCheck(execution: CheckExecution, issues: Issue[]): StoredCheck {
  return {
    id: redactText(execution.id),
    version: execution.version,
    status: storedStatus(execution.status),
    ...(execution.reason ? {reason: {...execution.reason, message: redactText(execution.reason.message)}} : {}),
    analysis_mode: execution.analysis_mode,
    snapshot: snapshotDeterministicCheck(execution),
    findings: issues.map(issueToFinding).sort(compareStoredFindings),
  }
}

/**
 * Group issues under the check that produced them. A finding whose check has no checks_executed entry is
 * an engine bug: the scanner records every check it runs, so the document would silently lose the finding.
 */
function groupIssuesByCheck(result: ScanResult): Map<string, Issue[]> {
  const executedIds = new Set(result.scan.checks_executed.map((execution) => execution.id))
  const unexecuted = result.issues.find((issue) => !executedIds.has(issue.id))
  if (unexecuted) throw new Error(`Finding for a check that was not executed: ${unexecuted.id}`)
  return Map.groupBy(result.issues, (issue) => issue.id)
}

export interface BuildDeterministicFindingsOptions {
  scope: AppSecurityScope
  scanDirectories: CoverageScanDirectory[]
  engineVersion?: string
  ruleset?: string
  generatedAt?: string
}

/** Build deterministic-findings.json from a deterministic scan. Every free-form value is redacted. */
export function buildDeterministicFindings(
  result: ScanResult,
  options: BuildDeterministicFindingsOptions,
): DeterministicFindingsDocument {
  const issuesByCheck = groupIssuesByCheck(result)
  const checks = result.scan.checks_executed
    .map((execution) => storedCheck(execution, issuesByCheck.get(execution.id) ?? []))
    .sort((left, right) => compareStrings(left.id, right.id))
  return {
    schema_version: FINDINGS_SCHEMA_VERSION,
    source: 'deterministic',
    engine: {
      name: ENGINE_NAME,
      version: redactText(options.engineVersion ?? result.version),
      ruleset: redactText(options.ruleset ?? `app-security-rules@${result.version}`),
    },
    generated_at: options.generatedAt ?? new Date().toISOString(),
    detection: {
      ...result.detection,
      languages: result.detection.languages.map((language) => ({
        ...language,
        files: language.files.map((path) => redactText(path)),
      })),
    },
    coverage: {
      files_scanned: result.scan.files_scanned,
      files_skipped: (result.scan.files_skipped ?? []).map((file) => ({
        ...file,
        path: redactText(file.path),
        ...(file.detail ? {detail: redactText(file.detail)} : {}),
      })),
      gaps: result.scan.coverage_gaps.map((gap) => ({
        ...gap,
        message: redactText(gap.message),
        ...(gap.file ? {file: redactText(gap.file)} : {}),
      })),
      scope: redactScope(options.scope),
      scan_directories: options.scanDirectories.map((scanDirectory) => ({
        ...scanDirectory,
        directory: redactText(scanDirectory.directory),
      })),
    },
    checks,
  }
}
