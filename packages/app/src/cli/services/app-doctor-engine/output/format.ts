import {redactText} from '../rules/secret-rules.js'
import {redactIssue} from '../trace/index.js'
import type {Capabilities, Issue, ScanResult, Severity} from '../types.js'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const SEVERITY_SYMBOL: Record<Severity, string> = {
  critical: '✖',
  high: '⚠',
  medium: '⚠',
  low: 'ℹ',
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export interface FormatConsoleOptions {
  verbose?: boolean
  elapsedMilliseconds?: number
  /**
   * Number of unresolved needs_review findings. When set, the grade is marked
   * provisional — an unresolved app has not been cleared, and a bare "Excellent"
   * would imply otherwise.
   */
  provisional?: number
}

export function formatConsole(result: ScanResult, options: FormatConsoleOptions = {}): string {
  const lines: string[] = []
  const issues = sortIssues(result.issues)
  const elapsedSuffix =
    options.elapsedMilliseconds === undefined ? '' : ` in ${formatElapsed(options.elapsedMilliseconds)}`

  lines.push('')
  lines.push(`✔ Scanned ${result.scan.files_scanned} files${elapsedSuffix}`)
  // An unscanned file is not a clean file — never let incomplete coverage pass
  // silently, or a reader will mistake "did not look" for "looked, found nothing".
  const skipped = result.scan.files_skipped_count ?? 0
  if (skipped > 0) {
    const detail = result.scan.files_skipped ?? []
    const tooLarge = detail.filter((file) => file.reason === 'too_large').length
    const unreadable = detail.filter((file) => file.reason === 'unreadable').length
    const parts: string[] = []
    if (tooLarge > 0) parts.push(`${tooLarge} too large`)
    if (unreadable > 0) parts.push(`${unreadable} unreadable`)
    lines.push(
      `⚠ ${skipped} file${skipped === 1 ? '' : 's'} NOT scanned (${parts.join(', ')}) — coverage is incomplete`,
    )
    for (const file of detail.slice(0, 5)) {
      const size = file.size_bytes ? ` (${Math.round(file.size_bytes / 1024)} KB)` : ''
      lines.push(`    ${redactText(file.path)}${size}`)
    }
    if (detail.length > 5) lines.push(`    …and ${detail.length - 5} more`)
  }
  lines.push('')
  lines.push(`Shopify App Doctor — ${redactText(result.app.name)}`)
  const provisionalSuffix =
    options.provisional && options.provisional > 0 ? `  (provisional — ${options.provisional} unresolved)` : ''
  lines.push(`Score: ${result.score.total} / 100 ${formatGrade(result.score.grade)}${provisionalSuffix}`)

  if (issues.length === 0) {
    lines.push('')
    lines.push('✔ No security issues found')
  } else {
    lines.push('')
    lines.push(`${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`)
    lines.push(formatSeveritySummary(issues))
    lines.push('')
    for (const issue of issues) {
      lines.push(formatIssue(issue, options.verbose === true))
      lines.push('')
    }
  }

  if (options.verbose) {
    lines.push('Scan details')
    lines.push(`  Capabilities: ${formatCapabilities(result.capabilities)}`)
    lines.push(`  Rules run: ${result.scan.rules_run} | Skipped: ${result.scan.rules_skipped}`)
    lines.push(`  Input hash: ${result.scan.input_hash}`)
    lines.push(`  Result hash: ${result.scan.result_hash}`)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function formatIssue(issueInput: Issue, verbose = false): string {
  const issue = redactIssue(issueInput)
  const location = issue.location.line ? `${issue.location.file}:${issue.location.line}` : issue.location.file
  const lines = [`${SEVERITY_SYMBOL[issue.severity]} ${issue.title}`, `  ${issue.id}`, `  ${location}`]
  if (verbose) {
    lines.push(`  ${issue.message}`)
    lines.push(`  Fix: ${issue.fix.description}`)
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
    if (fileDifference !== 0) return fileDifference
    return (left.location.line ?? 0) - (right.location.line ?? 0)
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
  const active: string[] = []
  if (capabilities.theme_app_extension) active.push('theme_app_extension')
  if (capabilities.app_embed) active.push('app_embed')
  if (capabilities.script_tags) active.push('script_tags')
  if (capabilities.webhooks) active.push('webhooks')
  if (capabilities.app_proxy) active.push('app_proxy')
  if (capabilities.storefront_metafield_writes) active.push('storefront_metafields')
  if (capabilities.has_backend) active.push('backend')
  if (capabilities.checkout_extension) active.push('checkout_extension')
  if (capabilities.declared_ip_allowlist) active.push('ip_allowlist')
  return active.length > 0 ? active.join(', ') : 'none detected'
}

function formatGrade(grade: ScanResult['score']['grade']): string {
  return grade
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase())
}

function formatElapsed(elapsedMilliseconds: number): string {
  if (elapsedMilliseconds < 1000) return `${Math.round(elapsedMilliseconds)}ms`
  return `${(elapsedMilliseconds / 1000).toFixed(1)}s`
}
