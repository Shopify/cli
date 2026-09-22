import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {
  groupIssues,
  type Capabilities,
  type Issue,
  type IssueGroup,
  type ScanResult,
  type Severity,
} from './app-security-engine/index.js'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection, InlineToken, RenderAlertOptions, Token, TokenItem} from '@shopify/cli-kit/node/ui'

interface SecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface SecurityReportInput {
  scan: ScanResult
  engine: SecurityEngineMetadata
  verbose: boolean
  elapsedMilliseconds: number
  commands: AppSecurityCommands
  tracePath: string
  reviewPath?: string
  reviewCheckCount?: number
  findings?: {
    accepted: number
    rejected: string[]
    warnings?: string[]
  }
}

type SecurityAlertType = 'success' | 'warning' | 'error'

interface SecurityAlert {
  type: SecurityAlertType
  options: RenderAlertOptions
}

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
const SAMPLE_FILE_COUNT = 3

export function buildSecurityAlert(input: SecurityReportInput): SecurityAlert {
  const type = securityAlertType(input)
  const groups = groupIssues(input.scan.issues)

  return {
    type,
    options: {
      headline: securityHeadline(input, groups),
      body: securityBody(input),
      ...(input.findings ? {} : {nextSteps: securityNextSteps(input.commands)}),
      reference: [
        {subdued: `Engine: ${input.engine.name} ${input.engine.version}`},
        {subdued: `Ruleset: ${input.engine.ruleset}`},
        ...(groups.some((group) => group.issues.length > 1) && !input.verbose
          ? [{subdued: 'Use --verbose for every occurrence and fix. The trace retains all file and line details.'}]
          : []),
      ],
      customSections: securityCustomSections(input, groups),
    },
  }
}

export function renderSecurityReport(input: SecurityReportInput): void {
  const {type, options} = buildSecurityAlert(input)
  if (type === 'success') {
    renderSuccess(options)
    return
  }
  if (type === 'warning') {
    renderWarning(options)
    return
  }
  renderError(options)
}

function coverageIncomplete(input: SecurityReportInput): boolean {
  return input.scan.score === null || !input.scan.scan.coverage_complete || input.scan.scan.coverage_gaps.length > 0
}

function securityAlertType(input: SecurityReportInput): SecurityAlertType {
  if (input.findings && input.findings.rejected.length > 0) return 'error'
  if (input.scan.issues.some((issue) => issue.severity === 'high')) return 'error'
  if (input.scan.issues.length > 0) return 'warning'
  if (coverageIncomplete(input)) return 'warning'
  return 'success'
}

function securityHeadline(input: SecurityReportInput, groups: IssueGroup[]): string {
  if (input.findings && input.findings.rejected.length > 0) {
    return 'App Security could not compile some agent findings.'
  }

  const count = input.scan.issues.length
  if (groups.length < count) {
    return `${groups.length} security issue ${groups.length === 1 ? 'group' : 'groups'} found (${count} occurrences).`
  }
  if (count > 0) return `${count} security ${count === 1 ? 'issue' : 'issues'} found.`
  if (coverageIncomplete(input)) return 'Scan completed with coverage gaps.'
  return 'No security issues found.'
}

function securityBody(input: SecurityReportInput): TokenItem {
  const scan = input.scan
  const tokens: Token[] = [
    {userInput: scan.app.name},
    {char: '.'},
    `${scan.scan.files_scanned} files scanned in ${formatElapsed(input.elapsedMilliseconds)}.`,
  ]

  const notApplicable = scan.scan.checks_executed.filter((execution) => execution.status === 'not_applicable').length
  if (notApplicable > 0) {
    tokens.push({info: `\n${notApplicable} check${notApplicable === 1 ? '' : 's'} not applicable.`})
  }

  if (input.reviewCheckCount !== undefined) {
    tokens.push({
      info: `\n${input.reviewCheckCount} check${input.reviewCheckCount === 1 ? '' : 's'} ready for your coding agent.`,
    })
  }

  return tokens
}

function securityNextSteps(commands: AppSecurityCommands): TokenItem<InlineToken>[] {
  return [
    ['Investigate the review pack, then compile the trace with', {command: formatAppSecurityCommand(commands.compile)}],
  ]
}

function securityCustomSections(input: SecurityReportInput, groups: IssueGroup[]): AlertCustomSection[] {
  const sections: AlertCustomSection[] = []

  for (const severity of ['high', 'medium', 'low'] as const) {
    const severityGroups = groups.filter((group) => group.severity === severity)
    if (severityGroups.length === 0) continue
    sections.push({
      title: SEVERITY_LABEL[severity],
      body: {
        list: {
          items: severityGroups.flatMap((group) => [
            issueGroupListItem(group),
            ...(input.verbose ? group.issues.map(issueListItem) : []),
          ]),
        },
      },
    })
  }

  if (input.scan.scan.coverage_gaps.length > 0) {
    const gaps = input.scan.scan.coverage_gaps
    const items: TokenItem<InlineToken>[] = gaps.slice(0, 8).map((gap) => gap.message)
    if (gaps.length > 8) items.push({info: `${gaps.length - 8} more coverage gaps`})
    sections.push({title: 'Coverage gaps', body: {list: {items}}})
  }

  if (input.findings) {
    const items: TokenItem<InlineToken>[] = [
      input.findings.accepted === 0 && input.findings.rejected.length > 0
        ? 'No agent findings were merged.'
        : `Merged ${input.findings.accepted} agent finding(s) into the trace.`,
      ...input.findings.rejected.map((reason) => ({error: `Rejected: ${reason}`})),
      ...(input.findings.warnings ?? []).map((reason) => ({warn: reason})),
      ['Trace written to', {filePath: input.tracePath}],
    ]
    sections.push({title: 'Agent findings', body: {list: {items}}})
  } else if (input.reviewPath) {
    sections.push({
      title: 'Artifacts',
      body: {
        list: {
          items: [
            ['Review pack:', {filePath: input.reviewPath}],
            ['Trace:', {filePath: input.tracePath}],
          ],
        },
      },
    })
  }

  if (input.verbose) {
    sections.push({
      title: 'Scan details',
      body: {
        tabularData: [
          ['Framework', input.scan.detection.framework],
          ['Surface', input.scan.detection.surface],
          [
            'Languages',
            input.scan.detection.languages.map((language) => `${language.name} (${language.support})`).join(', ') ||
              'none',
          ],
          ['Capabilities', formatCapabilities(input.scan.capabilities)],
          ['Rules run', String(input.scan.scan.rules_run)],
          ['Not run', String(input.scan.scan.rules_skipped)],
          ['Input hash', input.scan.scan.input_hash],
          ['Result hash', input.scan.scan.result_hash],
        ],
        firstColumnSubdued: true,
      },
    })
  }

  return sections
}

function issueListItem(issue: Issue): TokenItem<InlineToken> {
  const location = issue.location.line ? `${issue.location.file}:${issue.location.line}` : issue.location.file
  const item: InlineToken[] = [{bold: issue.title}, {subdued: issue.id}, {filePath: location}]

  item.push({subdued: issue.message}, {subdued: `Fix: ${issue.fix.description}`})
  if (issue.fix.guide) {
    if (issue.fix.guide.startsWith('https://') || issue.fix.guide.startsWith('http://')) {
      item.push({link: {label: 'Docs', url: issue.fix.guide}})
    } else {
      item.push({subdued: `Docs: ${issue.fix.guide}`})
    }
  }
  if (issue.snippet) item.push({subdued: `Code: ${issue.snippet}`})

  return item
}

function issueGroupListItem(group: IssueGroup): TokenItem<InlineToken> {
  const issue = group.issues[0]!
  const count = group.issues.length
  const files = group.files.length
  const samples = group.files.slice(0, SAMPLE_FILE_COUNT).map((file) => {
    const sample = group.issues.find((occurrence) => occurrence.location.file === file)!
    const location = sample.location.line ? `${file}:${sample.location.line}` : file
    return {filePath: location}
  })
  return [
    {bold: issue.title},
    {subdued: issue.id},
    `${count} ${count === 1 ? 'occurrence' : 'occurrences'} across ${files} ${files === 1 ? 'file' : 'files'}`,
    ...samples,
    ...(files > SAMPLE_FILE_COUNT ? [{subdued: `+${files - SAMPLE_FILE_COUNT} more files`}] : []),
  ]
}

function formatCapabilities(capabilities: Capabilities): string {
  const active = Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
  return active.length > 0 ? active.join(', ') : 'none detected'
}

function formatElapsed(elapsedMilliseconds: number): string {
  return elapsedMilliseconds < 1000
    ? `${Math.round(elapsedMilliseconds)}ms`
    : `${(elapsedMilliseconds / 1000).toFixed(1)}s`
}
