import {
  redactIssue,
  redactText,
  sortIssues,
  type Capabilities,
  type Issue,
  type ScanResult,
  type Severity,
} from './app-doctor-engine/index.js'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection, InlineToken, RenderAlertOptions, Token, TokenItem} from '@shopify/cli-kit/node/ui'

interface DoctorEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface DoctorReportInput {
  scan: ScanResult
  engine: DoctorEngineMetadata
  verbose: boolean
  elapsedMilliseconds: number
  tracePath: string
  reviewPath?: string
  reviewCheckCount?: number
  findings?: {
    accepted: number
    rejected: string[]
    warnings?: string[]
  }
}

type DoctorAlertType = 'success' | 'warning' | 'error'

interface DoctorAlert {
  type: DoctorAlertType
  options: RenderAlertOptions
}

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}

export function buildDoctorAlert(input: DoctorReportInput): DoctorAlert {
  const type = doctorAlertType(input)

  return {
    type,
    options: {
      headline: doctorHeadline(input),
      body: doctorBody(input),
      ...(input.findings ? {} : {nextSteps: doctorNextSteps()}),
      reference: [
        {subdued: `Engine: ${input.engine.name} ${input.engine.version}`},
        {subdued: `Ruleset: ${input.engine.ruleset}`},
      ],
      customSections: doctorCustomSections(input),
    },
  }
}

export function renderDoctorReport(input: DoctorReportInput): void {
  const {type, options} = buildDoctorAlert(input)
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

function coverageIncomplete(input: DoctorReportInput): boolean {
  return input.scan.score === null || !input.scan.scan.coverage_complete || input.scan.scan.coverage_gaps.length > 0
}

function doctorAlertType(input: DoctorReportInput): DoctorAlertType {
  if (input.findings && input.findings.rejected.length > 0) return 'error'
  if (input.scan.issues.some((issue) => issue.severity === 'high')) return 'error'
  if (input.scan.issues.length > 0) return 'warning'
  if (coverageIncomplete(input)) return 'warning'
  return 'success'
}

function doctorHeadline(input: DoctorReportInput): string {
  if (input.findings && input.findings.rejected.length > 0) {
    return 'App Doctor could not compile some agent findings.'
  }

  const count = input.scan.issues.length
  if (count > 0) return `${count} security ${count === 1 ? 'issue' : 'issues'} found.`
  if (coverageIncomplete(input)) return 'Scan completed with coverage gaps.'
  return 'No security issues found.'
}

function doctorBody(input: DoctorReportInput): TokenItem {
  const scan = input.scan
  const tokens: Token[] = [
    {userInput: redactText(scan.app.name)},
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

function doctorNextSteps(): TokenItem<InlineToken>[] {
  return [
    [
      'Investigate the review pack, then compile the trace with',
      {command: 'shopify app doctor --findings .shopify/app-doctor/findings.json'},
    ],
  ]
}

function doctorCustomSections(input: DoctorReportInput): AlertCustomSection[] {
  const sections: AlertCustomSection[] = []

  for (const group of groupIssuesBySeverity(input.scan.issues)) {
    sections.push({
      title: SEVERITY_LABEL[group.severity],
      body: {
        list: {
          items: group.issues.map((issue) => issueListItem(issue, input.verbose)),
        },
      },
    })
  }

  if (input.scan.scan.coverage_gaps.length > 0) {
    const gaps = input.scan.scan.coverage_gaps
    const items: TokenItem<InlineToken>[] = gaps.slice(0, 8).map((gap) => redactText(gap.message))
    if (gaps.length > 8) items.push({info: `${gaps.length - 8} more coverage gaps`})
    sections.push({title: 'Coverage gaps', body: {list: {items}}})
  }

  if (input.findings) {
    const items: TokenItem<InlineToken>[] = [
      input.findings.accepted === 0 && input.findings.rejected.length > 0
        ? 'No agent findings were merged.'
        : `Merged ${input.findings.accepted} agent finding(s) into the trace.`,
      ...input.findings.rejected.map((reason) => ({error: `Rejected: ${redactText(reason)}`})),
      ...(input.findings.warnings ?? []).map((reason) => ({warn: redactText(reason)})),
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

function issueListItem(issueInput: Issue, verbose: boolean): TokenItem<InlineToken> {
  const issue = redactIssue(issueInput)
  const location = issue.location.line ? `${issue.location.file}:${issue.location.line}` : issue.location.file
  const item: InlineToken[] = [{bold: issue.title}, {subdued: issue.id}, {filePath: location}]

  if (verbose) {
    item.push({subdued: issue.message}, {subdued: `Fix: ${issue.fix.description}`})
    if (issue.fix.guide) {
      if (issue.fix.guide.startsWith('https://') || issue.fix.guide.startsWith('http://')) {
        item.push({link: {label: 'Docs', url: issue.fix.guide}})
      } else {
        item.push({subdued: `Docs: ${issue.fix.guide}`})
      }
    }
    if (issue.snippet) item.push({subdued: `Code: ${issue.snippet}`})
  }

  return item
}

function groupIssuesBySeverity(issues: Issue[]): {severity: Severity; issues: Issue[]}[] {
  const groups: {severity: Severity; issues: Issue[]}[] = []
  for (const issue of sortIssues(issues)) {
    const last = groups[groups.length - 1]
    if (last?.severity === issue.severity) last.issues.push(issue)
    else groups.push({severity: issue.severity, issues: [issue]})
  }
  return groups
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
