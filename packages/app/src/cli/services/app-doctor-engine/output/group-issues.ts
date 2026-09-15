import {findingPatternFingerprint} from '../trace/fingerprints.js'
import {redactIssue} from '../trace/index.js'
import type {Issue, Severity} from '../types.js'

export interface IssueGroup {
  fingerprint: string
  severity: Severity
  issues: Issue[]
  files: string[]
}

const SEVERITY_ORDER: Record<Severity, number> = {high: 0, medium: 1, low: 2}

/** A presentation view only: never replace scan issues or trace findings with these groups. */
export function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  const sorted = issues
    .map(redactIssue)
    .sort(
      (left, right) =>
        SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
        left.location.file.localeCompare(right.location.file) ||
        (left.location.line ?? 0) - (right.location.line ?? 0) ||
        (left.location.column ?? 0) - (right.location.column ?? 0) ||
        left.id.localeCompare(right.id) ||
        left.title.localeCompare(right.title),
    )
  for (const issue of sorted) {
    const source = issue.found_by ?? 'static'
    const fingerprint = findingPatternFingerprint({
      source: source === 'static' ? 'deterministic' : source,
      rule_id: issue.found_by === 'agent' ? undefined : issue.id,
      check_id: issue.found_by === 'agent' ? issue.id : undefined,
      pattern_id: issue.pattern_id,
    })
    // Never promote or downgrade a finding because another occurrence has a different severity.
    const key = `${fingerprint}|${issue.severity}`
    const group = groups.get(key)
    if (group) group.issues.push(issue)
    else groups.set(key, {fingerprint, severity: issue.severity, issues: [issue], files: []})
  }
  return [...groups.values()].map((group) => ({
    ...group,
    files: [...new Set(group.issues.map((issue) => issue.location.file))],
  }))
}
