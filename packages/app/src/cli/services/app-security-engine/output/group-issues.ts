import {SEVERITY_RANK, type Issue, type Severity, type SkippedFile} from '../types.js'
import {groupBy} from '@shopify/cli-kit/common/collection'

export interface IssueGroup {
  severity: Severity
  issues: Issue[]
  files: string[]
}

function groupKey(issue: Issue): string {
  return [issue.id, issue.pattern_id ?? '', issue.severity].join('|')
}

/** A presentation view only: never replace scan issues or deterministic-findings.json findings with these groups. */
export function groupIssues(issues: Issue[]): IssueGroup[] {
  const sorted = [...issues].sort(
    (left, right) =>
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
      left.location.file.localeCompare(right.location.file) ||
      (left.location.line ?? 0) - (right.location.line ?? 0) ||
      (left.location.column ?? 0) - (right.location.column ?? 0) ||
      left.id.localeCompare(right.id) ||
      left.title.localeCompare(right.title),
  )
  return Object.values(groupBy(sorted, groupKey)).map((groupedIssues) => ({
    severity: groupedIssues[0]!.severity,
    issues: groupedIssues,
    files: [...new Set(groupedIssues.map((issue) => issue.location.file))],
  }))
}

/** How many files the deterministic scan skipped, by reason. */
interface SkippedFileCounts {
  too_large: number
  unreadable: number
}

export function skippedFileCounts(files: SkippedFile[]): SkippedFileCounts {
  return {
    too_large: files.filter((file) => file.reason === 'too_large').length,
    unreadable: files.filter((file) => file.reason === 'unreadable').length,
  }
}
