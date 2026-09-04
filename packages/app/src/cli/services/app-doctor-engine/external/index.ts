import {isSafeRelativePath} from '../checks/index.js'
import {redactIssue} from '../trace/index.js'
import {redactText} from '../rules/secret-rules.js'
import type {FindingEvidence, Issue, Location, Severity} from '../types.js'

export interface ExternalFinding {
  rule_id: string
  rule_version: number
  severity: Severity
  title: string
  message: string
  location: Location
  evidence?: FindingEvidence[]
  snippet?: string
  fix?: {description: string; guide?: string}
}

const MAX_FINDINGS = 1_000
const MAX_EVIDENCE = 50
const MAX_TEXT_LENGTH = 8_000
const MAX_PATH_LENGTH = 1_024

const severities = new Set<Severity>(['high', 'medium', 'low'])

export function validateExternalFinding(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'finding must be an object'
  const finding = value as Record<string, unknown>
  if (typeof finding.rule_id !== 'string' || !finding.rule_id) return 'missing or invalid rule_id'
  if (!Number.isInteger(finding.rule_version) || (finding.rule_version as number) < 1) return 'invalid rule_version'
  if (typeof finding.severity !== 'string' || !severities.has(finding.severity as Severity)) return 'invalid severity'
  if (typeof finding.title !== 'string' || !finding.title) return 'missing or invalid title'
  if (typeof finding.message !== 'string' || !finding.message) return 'missing or invalid message'
  if (finding.snippet !== undefined && typeof finding.snippet !== 'string') return 'snippet must be a string'
  if (
    finding.title.length > MAX_TEXT_LENGTH ||
    finding.message.length > MAX_TEXT_LENGTH ||
    (typeof finding.snippet === 'string' && finding.snippet.length > MAX_TEXT_LENGTH)
  )
    return `text exceeds ${MAX_TEXT_LENGTH} characters`
  if (!finding.location || typeof finding.location !== 'object' || Array.isArray(finding.location))
    return 'missing or invalid location'
  const location = finding.location as Record<string, unknown>
  if (typeof location.file !== 'string' || !location.file) return 'missing or invalid location file'
  if (location.file.length > MAX_PATH_LENGTH) return `path exceeds ${MAX_PATH_LENGTH} characters`
  if (!isSafeRelativePath(location.file)) return 'unsafe finding location'
  if (location.line !== undefined && (!Number.isInteger(location.line) || (location.line as number) < 1))
    return 'invalid finding line'
  if (finding.evidence !== undefined && !Array.isArray(finding.evidence)) return 'evidence must be an array'
  if (Array.isArray(finding.evidence) && finding.evidence.length > MAX_EVIDENCE)
    return `finding exceeds ${MAX_EVIDENCE} evidence citations`
  for (const value of (finding.evidence as unknown[] | undefined) ?? []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'evidence citation must be an object'
    const evidence = value as Record<string, unknown>
    if (!evidence.location || typeof evidence.location !== 'object' || Array.isArray(evidence.location))
      return 'missing or invalid evidence location'
    const evidenceLocation = evidence.location as Record<string, unknown>
    if (typeof evidenceLocation.file !== 'string' || !evidenceLocation.file) return 'missing or invalid evidence file'
    if (evidenceLocation.file.length > MAX_PATH_LENGTH) return `evidence path exceeds ${MAX_PATH_LENGTH} characters`
    if (!isSafeRelativePath(evidenceLocation.file)) return 'unsafe evidence location'
    if (
      evidenceLocation.line !== undefined &&
      (!Number.isInteger(evidenceLocation.line) || (evidenceLocation.line as number) < 1)
    )
      return 'invalid evidence line'
    if (evidence.quote !== undefined && typeof evidence.quote !== 'string') return 'evidence quote must be a string'
    if (typeof evidence.quote === 'string' && evidence.quote.length > MAX_TEXT_LENGTH)
      return `evidence quote exceeds ${MAX_TEXT_LENGTH} characters`
  }
  if (finding.fix !== undefined) {
    if (!finding.fix || typeof finding.fix !== 'object' || Array.isArray(finding.fix)) return 'fix must be an object'
    const fix = finding.fix as Record<string, unknown>
    if (typeof fix.description !== 'string' || !fix.description) return 'fix description must be a non-empty string'
    if (fix.guide !== undefined && typeof fix.guide !== 'string') return 'fix guide must be a string'
    if (
      fix.description.length > MAX_TEXT_LENGTH ||
      (typeof fix.guide === 'string' && fix.guide.length > MAX_TEXT_LENGTH)
    )
      return `fix text exceeds ${MAX_TEXT_LENGTH} characters`
  }
  return undefined
}

export function mergeExternalFindings(
  issues: Issue[],
  findings: ExternalFinding[],
  options: {knownFiles?: ReadonlySet<string>} = {},
): {accepted: number; rejected: string[]} {
  const rejected: string[] = []
  let accepted = 0
  if (findings.length > MAX_FINDINGS)
    return {
      accepted: 0,
      rejected: [`external findings exceed the limit of ${MAX_FINDINGS}`],
    }
  for (const finding of findings) {
    const problem = validateExternalFinding(finding)
    if (problem) {
      const id = finding && typeof finding === 'object' ? finding.rule_id : '<unknown>'
      rejected.push(`${id}: ${problem}`)
      continue
    }
    const normalize = (path: string) => redactText(path.replace(/\\/g, '/'))
    if (options.knownFiles && !options.knownFiles.has(normalize(finding.location.file))) {
      rejected.push(`${finding.rule_id}: finding file was not part of the scanned inputs`)
      continue
    }
    const unknownEvidence = finding.evidence?.find(
      (item) => options.knownFiles && !options.knownFiles.has(normalize(item.location.file)),
    )
    if (unknownEvidence) {
      rejected.push(`${finding.rule_id}: evidence file was not part of the scanned inputs`)
      continue
    }
    issues.push(
      redactIssue({
        id: finding.rule_id,
        rule_version: finding.rule_version,
        found_by: 'external',
        severity: finding.severity,
        points: 0,
        title: finding.title,
        message: finding.message,
        location: finding.location,
        evidence: finding.evidence,
        snippet: finding.snippet,
        fix: {
          automated: false,
          description: finding.fix?.description ?? 'Review the external finding.',
          guide: finding.fix?.guide,
        },
        confidence: 'agentic',
      }),
    )
    accepted++
  }
  return {accepted, rejected}
}
