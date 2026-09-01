import {redactText} from '../rules/secret-rules.js'
import {redactIssue} from '../trace/index.js'
import figures from '@shopify/cli-kit/node/figures'
import type {Capabilities, Issue, ScanResult, Severity} from '../types.js'

const SEVERITY_ORDER: Record<Severity, number> = {high: 3, medium: 2, low: 1}
const SEVERITY_SYMBOL: Record<Severity, string> = {
  high: figures.cross,
  medium: figures.warning,
  low: figures.info,
}
const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}

interface FormatConsoleOptions {
  verbose?: boolean
  elapsedMilliseconds?: number
}

export function formatConsole(result: ScanResult, options: FormatConsoleOptions = {}): string {
  const lines: string[] = []
  const issues = sortIssues(result.issues)
  const elapsedSuffix =
    options.elapsedMilliseconds === undefined ? '' : ` in ${formatElapsed(options.elapsedMilliseconds)}`

  lines.push('', `${result.scan.files_scanned} files scanned${elapsedSuffix}`, '')
  lines.push(`Shopify App Doctor — ${redactText(result.app.name)}`)
  if (result.scan.coverage_complete && result.score) {
    lines.push(`${figures.tick} Coverage complete`)
    lines.push(`Score: ${result.score.total} / 100 ${formatGrade(result.score.grade)}`)
  } else {
    lines.push(`${figures.warning} Coverage incomplete — agent investigation required`)
    lines.push('Score: Not available')
    if (
      result.detection.surface === 'unknown' ||
      result.detection.framework === 'unknown' ||
      result.detection.framework === 'mixed'
    )
      lines.push(`${figures.info} Unsupported backend: agent tier only`)
    for (const gap of result.scan.coverage_gaps.slice(0, 8)) lines.push(`  ${figures.warning} ${gap.message}`)
    if (result.scan.coverage_gaps.length > 8)
      lines.push(`  ${figures.info} ${result.scan.coverage_gaps.length - 8} more coverage gaps`)
  }

  const notApplicable = result.scan.checks_executed.filter((execution) => execution.status === 'not_applicable').length
  if (notApplicable > 0)
    lines.push(`${figures.info} ${notApplicable} check${notApplicable === 1 ? '' : 's'} not applicable`)

  if (issues.length === 0) {
    if (result.scan.coverage_complete) lines.push('', `${figures.tick} No security issues found`)
  } else {
    lines.push('', `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`, formatSeveritySummary(issues), '')
    for (const issue of issues) lines.push(formatIssue(issue, options.verbose === true), '')
  }

  if (options.verbose) {
    lines.push('Scan details')
    lines.push(`  Framework: ${result.detection.framework}`)
    lines.push(`  Surface: ${result.detection.surface}`)
    lines.push(
      `  Languages: ${result.detection.languages.map((language) => `${language.name} (${language.support})`).join(', ') || 'none'}`,
    )
    lines.push(`  Capabilities: ${formatCapabilities(result.capabilities)}`)
    lines.push(`  Rules run: ${result.scan.rules_run} | Not run: ${result.scan.rules_skipped}`)
    lines.push(`  Input hash: ${result.scan.input_hash}`)
    lines.push(`  Result hash: ${result.scan.result_hash}`, '')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function formatIssue(issueInput: Issue, verbose = false): string {
  const issue = redactIssue(issueInput)
  const location = issue.location.line ? `${issue.location.file}:${issue.location.line}` : issue.location.file
  const lines = [
    `${SEVERITY_SYMBOL[issue.severity]} ${SEVERITY_LABEL[issue.severity]}: ${issue.title}`,
    `  ${issue.id}`,
    `  ${location}`,
  ]
  if (verbose) {
    lines.push(`  ${issue.message}`, `  Fix: ${issue.fix.description}`)
    if (issue.fix.guide) lines.push(`  Docs: ${issue.fix.guide}`)
    if (issue.snippet) lines.push(`  Code: ${issue.snippet}`)
  }
  return lines.join('\n')
}

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

function formatSeveritySummary(issues: Issue[]): string {
  const counts = new Map<Severity, number>()
  for (const issue of issues) counts.set(issue.severity, (counts.get(issue.severity) ?? 0) + 1)
  return (Object.keys(SEVERITY_ORDER) as Severity[])
    .filter((severity) => (counts.get(severity) ?? 0) > 0)
    .sort((left, right) => SEVERITY_ORDER[right] - SEVERITY_ORDER[left])
    .map((severity) => `${SEVERITY_LABEL[severity]}: ${counts.get(severity)}`)
    .join(', ')
}

function formatCapabilities(capabilities: Capabilities): string {
  const active = Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
  return active.length > 0 ? active.join(', ') : 'none detected'
}

function formatGrade(grade: NonNullable<ScanResult['score']>['grade']): string {
  return grade
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase())
}

function formatElapsed(elapsedMilliseconds: number): string {
  return elapsedMilliseconds < 1000
    ? `${Math.round(elapsedMilliseconds)}ms`
    : `${(elapsedMilliseconds / 1000).toFixed(1)}s`
}
