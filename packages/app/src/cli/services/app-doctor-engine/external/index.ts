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

const severities = new Set<Severity>(['critical', 'high', 'medium', 'low'])

export function validateExternalFinding(finding: ExternalFinding): string | undefined {
  if (!finding || typeof finding !== 'object') return 'finding must be an object'
  if (!finding.rule_id) return 'missing rule_id'
  if (!Number.isInteger(finding.rule_version) || finding.rule_version < 1) return 'invalid rule_version'
  if (!severities.has(finding.severity)) return 'invalid severity'
  if (!finding.title || !finding.message) return 'title and message are required'
  if (
    finding.title.length > MAX_TEXT_LENGTH ||
    finding.message.length > MAX_TEXT_LENGTH ||
    (finding.snippet?.length ?? 0) > MAX_TEXT_LENGTH
  )
    return `text exceeds ${MAX_TEXT_LENGTH} characters`
  if (finding.location.file.length > MAX_PATH_LENGTH) return `path exceeds ${MAX_PATH_LENGTH} characters`
  if ((finding.evidence?.length ?? 0) > MAX_EVIDENCE) return `finding exceeds ${MAX_EVIDENCE} evidence citations`
  if (!isSafeRelativePath(finding.location.file)) return 'unsafe finding location'
  if (finding.location.line !== undefined && (!Number.isInteger(finding.location.line) || finding.location.line < 1))
    return 'invalid finding line'
  for (const evidence of finding.evidence ?? []) {
    if (evidence.location.file.length > MAX_PATH_LENGTH) return `evidence path exceeds ${MAX_PATH_LENGTH} characters`
    if ((evidence.quote?.length ?? 0) > MAX_TEXT_LENGTH) return `evidence quote exceeds ${MAX_TEXT_LENGTH} characters`
    if (!isSafeRelativePath(evidence.location.file)) return 'unsafe evidence location'
    if (
      evidence.location.line !== undefined &&
      (!Number.isInteger(evidence.location.line) || evidence.location.line < 1)
    )
      return 'invalid evidence line'
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
