import type {Issue, Severity} from '../types.js'

export interface IssueGroup {
  severity: Severity
  issues: Issue[]
  files: string[]
}

const SEVERITY_ORDER: Record<Severity, number> = {high: 0, medium: 1, low: 2}

function groupKey(issue: Issue): string {
  return [issue.found_by ?? 'static', issue.id, issue.pattern_id ?? '', issue.severity].join('|')
}

/** A presentation view only: never replace scan issues or trace findings with these groups. */
export function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  const sorted = [...issues].sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.location.file.localeCompare(right.location.file) ||
      (left.location.line ?? 0) - (right.location.line ?? 0) ||
      (left.location.column ?? 0) - (right.location.column ?? 0) ||
      left.id.localeCompare(right.id) ||
      left.title.localeCompare(right.title),
  )
  for (const issue of sorted) {
    const key = groupKey(issue)
    const group = groups.get(key)
    if (group) {
      group.issues.push(issue)
      if (!group.files.includes(issue.location.file)) group.files.push(issue.location.file)
    } else {
      groups.set(key, {severity: issue.severity, issues: [issue], files: [issue.location.file]})
    }
  }
  return [...groups.values()]
}
