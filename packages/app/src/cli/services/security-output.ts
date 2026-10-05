import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {
  effectiveClientId,
  selectedConfigFileName,
  type AppSecurityScanDirectory,
  type AppSecuritySelection,
} from './app-security-selection.js'
import {
  groupIssues,
  type Capabilities,
  type Issue,
  type IssueGroup,
  type ScanResult,
  type Severity,
} from './app-security-engine/index.js'
import {relativePath} from '@shopify/cli-kit/node/path'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {AlertCustomSection, InlineToken, RenderAlertOptions, Token, TokenItem} from '@shopify/cli-kit/node/ui'

interface SecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface SecurityReportInput {
  scan: ScanResult
  selection: AppSecuritySelection
  scanDirectories: AppSecurityScanDirectory[]
  engine: SecurityEngineMetadata
  verbose: boolean
  elapsedMilliseconds: number
  commands: AppSecurityCommands
  deterministicFindingsPath: string
  agentChecksPath: string
  agentCheckCount: number
}

type SecurityAlertType = 'success' | 'warning' | 'error'

interface SecurityAlert {
  type: SecurityAlertType
  options: RenderAlertOptions
}

const SEVERITY_LABEL: Record<Severity, string> = {high: 'High', medium: 'Medium', low: 'Low'}
const SAMPLE_FILE_COUNT = 3
const SAMPLE_COVERAGE_GAP_COUNT = 8

export function buildSecurityAlert(input: SecurityReportInput): SecurityAlert {
  const type = securityAlertType(input)
  const groups = groupIssues(input.scan.issues)

  return {
    type,
    options: {
      headline: securityHeadline(input, groups),
      body: securityBody(input),
      reference: [
        {subdued: `Engine: ${input.engine.name} ${input.engine.version}`},
        {subdued: `Ruleset: ${input.engine.ruleset}`},
        ...(groups.some((group) => group.issues.length > 1) && !input.verbose
          ? [
              {
                subdued:
                  'Use --verbose for every occurrence and fix. deterministic-findings.json retains all file and line details.',
              },
            ]
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
  return input.scan.scan.coverage_gaps.length > 0
}

function securityAlertType(input: SecurityReportInput): SecurityAlertType {
  if (input.scan.issues.some((issue) => issue.severity === 'high')) return 'error'
  if (input.scan.issues.length > 0) return 'warning'
  if (coverageIncomplete(input)) return 'warning'
  return 'success'
}

function securityHeadline(input: SecurityReportInput, groups: IssueGroup[]): string {
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

  tokens.push({
    info: `\n${input.agentCheckCount} check${input.agentCheckCount === 1 ? '' : 's'} ready for your coding agent.`,
  })

  return tokens
}

function securityNextSteps(input: SecurityReportInput): TokenItem<InlineToken>[] {
  return [
    ['Have your coding agent read', {filePath: input.agentChecksPath}],
    ['Record the agent results with', {command: formatAppSecurityCommand(input.commands.record)}],
    ['Review the results with', {command: formatAppSecurityCommand(input.commands.review)}],
  ]
}

function formatClientId(selection: AppSecuritySelection): string {
  const clientId = effectiveClientId(selection) ?? 'not linked'
  return selection.kind === 'config' && selection.clientIdOverride ? `${clientId} (from --client-id)` : clientId
}

function selectionSection(input: SecurityReportInput): AlertCustomSection {
  const {selection} = input
  return {
    title: 'Selection',
    body: {
      tabularData: [
        ['App directory', selection.appDirectory],
        ['Config file', selectedConfigFileName(selection) ?? 'none'],
        ['Client ID', formatClientId(selection)],
        [
          'Scan directories',
          input.scanDirectories.map(({directory}) => relativePath(selection.appDirectory, directory) || '.').join(', '),
        ],
      ],
      firstColumnSubdued: true,
    },
  }
}

function securityCustomSections(input: SecurityReportInput, groups: IssueGroup[]): AlertCustomSection[] {
  const sections: AlertCustomSection[] = [selectionSection(input)]

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
    const items: TokenItem<InlineToken>[] = gaps.slice(0, SAMPLE_COVERAGE_GAP_COUNT).map((gap) => gap.message)
    if (gaps.length > SAMPLE_COVERAGE_GAP_COUNT) {
      items.push({info: `${gaps.length - SAMPLE_COVERAGE_GAP_COUNT} more coverage gaps`})
    }
    sections.push({title: 'Coverage gaps', body: {list: {items}}})
  }

  sections.push({
    title: 'Artifacts',
    body: {
      list: {
        items: [
          ['Deterministic findings:', {filePath: input.deterministicFindingsPath}],
          ['Agent checks:', {filePath: input.agentChecksPath}],
        ],
      },
    },
  })

  sections.push({
    title: 'Next steps',
    body: {list: {items: securityNextSteps(input), ordered: true}},
  })

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
