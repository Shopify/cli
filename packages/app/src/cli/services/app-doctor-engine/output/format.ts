import {redactText} from '../rules/secret-rules.js'
import type {Issue, ScanResult, Severity} from '../types.js'

const SEVERITY_ORDER: Record<Severity, number> = {high: 3, medium: 2, low: 1}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, (_key, value) => (typeof value === 'string' ? redactText(value) : value), 2)
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    const severityDifference = SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity]
    if (severityDifference !== 0) return severityDifference
    const fileDifference = left.location.file.localeCompare(right.location.file)
    return fileDifference === 0 ? (left.location.line ?? 0) - (right.location.line ?? 0) : fileDifference
  })
}
