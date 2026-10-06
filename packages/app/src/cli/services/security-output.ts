import {securityExitCode, type AppSecurityBlockingLevel} from './app-security-api.js'
import {formatAppSecurityCommand, type AppSecurityCommands} from './app-security-commands.js'
import {appSecurityInstructions} from './app-security-instructions.js'
import {deliverAppSecurityInstructions, renderAppSecurityInstructions} from './app-security-instructions-output.js'
import {
  securityCheckJsonOutputSchema,
  toSecurityCheckCancelledJson,
  toSecurityCheckFileListJson,
  toSecurityCheckJson,
} from './security-check-json.js'
import {toAppSecurityInstructionsJson, type AppSecurityInstructionsJson} from './security-instructions-json.js'
import {
  effectiveClientId,
  selectedConfigFileName,
  type AppSecurityScanDirectory,
  type AppSecuritySelection,
} from './app-security-selection.js'
import {
  checkDocsUrl,
  groupIssues,
  type Capabilities,
  type Issue,
  type IssueGroup,
  type ScanResult,
  type Severity,
} from './app-security-engine/index.js'
import {outputInfo, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {cwd, relativePath} from '@shopify/cli-kit/node/path'
import {renderError, renderInfo, renderSelectPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import type {SecurityCheckResult} from './security-check.js'
import type {
  AlertCustomSection,
  InlineToken,
  RenderAlertOptions,
  RenderSelectPromptOptions,
  Token,
  TokenItem,
} from '@shopify/cli-kit/node/ui'

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

function renderSecurityReport(input: SecurityReportInput): void {
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

type SecurityCheckOutputFormat = 'json' | 'text'

type SecurityCheckScan = Extract<SecurityCheckResult, {kind: 'scan'}>

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

export interface SecurityCheckRenderOptions {
  format: SecurityCheckOutputFormat
  verbose: boolean
  blocking: AppSecurityBlockingLevel
  yes: boolean
  skipInstructions: boolean
  canPrompt: boolean
}

interface SecurityCheckRenderDependencies {
  selectInstructionsDestination(agentCheckCount: number): Promise<AppSecurityInstructionsDestination>
  deliverInstructions(content: string, delivery: {copy: boolean}): Promise<void>
  setExitCode(exitCode: number): void
}

export function appSecurityInstructionsPrompt(
  agentCheckCount: number,
): RenderSelectPromptOptions<AppSecurityInstructionsDestination> {
  return {
    message: `${agentCheckCount} recommended agent ${agentCheckCount === 1 ? 'check' : 'checks'} available to complete your scan. How do you want to pass that prompt to your agent?`,
    choices: [
      {label: 'Copy instructions to the clipboard', value: 'copy'},
      {label: 'Print instructions to the terminal', value: 'print'},
      {label: 'Nothing', value: 'nothing'},
    ],
    defaultValue: 'copy',
  }
}

const defaultCheckRenderDependencies: SecurityCheckRenderDependencies = {
  selectInstructionsDestination: (agentCheckCount) =>
    renderSelectPrompt(appSecurityInstructionsPrompt(agentCheckCount)),
  deliverInstructions: deliverAppSecurityInstructions,
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

/** Shows the command that repeats a run without the prompts it just showed. */
export function renderSecurityCheckPromptsNotice(
  commands: AppSecurityCommands,
  format: SecurityCheckOutputFormat,
): void {
  const scanCommand = formatAppSecurityCommand(commands.scan)
  if (format === 'json') {
    outputInfo(`To skip these prompts next time, run: ${scanCommand}`)
  } else {
    renderInfo({headline: 'To skip these prompts next time, run:', body: [{command: scanCommand}]})
  }
}

/**
 * Presents a check result: the gathered files, or the scan report or JSON result with the coding-agent instructions
 * chosen for it. In JSON mode the instructions are chosen and delivered before the result is printed, since they're
 * part of it. A finding at the `blocking` level sets the exit code. A cancelled run prints nothing in text mode, since
 * the user just declined the prompt.
 */
export async function renderSecurityCheckResult(
  result: SecurityCheckResult,
  options: SecurityCheckRenderOptions,
  dependencies: SecurityCheckRenderDependencies = defaultCheckRenderDependencies,
): Promise<void> {
  if (result.kind === 'cancelled') {
    if (options.format === 'json') outputResult(securityCheckJsonOutputSchema.encode(toSecurityCheckCancelledJson()))
    return
  }

  if (result.kind === 'file-list') {
    warnAboutIgnoredScanDirectories(result.ignoredScanDirectories, options.format)
    if (options.format === 'json') {
      const {appDirectory} = result.resolution.selection
      outputResult(securityCheckJsonOutputSchema.encode(toSecurityCheckFileListJson(appDirectory, result.paths)))
    } else if (result.paths.length > 0) {
      outputResult(result.paths.join('\n'))
    }
    return
  }

  const {execution, artifacts, resolution, scanDirectories} = result
  warnAboutIgnoredScanDirectories(execution.ignoredScanDirectories, options.format)
  if (options.format === 'json') {
    const instructions = await deliverChosenInstructions(result, options, dependencies)
    outputResult(
      securityCheckJsonOutputSchema.encode(
        toSecurityCheckJson(execution, artifacts.agentChecksPath, resolution.selection, scanDirectories, instructions),
      ),
    )
  } else {
    renderSecurityReport(securityReportInput(result, options.verbose))
    const instructions = await deliverChosenInstructions(result, options, dependencies)
    if (instructions) renderAppSecurityInstructions(instructions)
  }

  const exitCode = securityExitCode(execution, options.blocking)
  if (exitCode !== 0) dependencies.setExitCode(exitCode)
}

async function deliverChosenInstructions(
  result: SecurityCheckScan,
  options: SecurityCheckRenderOptions,
  dependencies: SecurityCheckRenderDependencies,
): Promise<AppSecurityInstructionsJson | null> {
  const destination = await instructionsDestination(options, dependencies, result.execution.agentChecks.checks.length)
  if (destination === 'nothing') return null
  const {selection, resultsKey, commands, scope} = result.resolution
  const content = appSecurityInstructions({
    appDirectory: selection.appDirectory,
    resultsKey,
    commands,
    scanScope: scope,
  })
  const delivery = {copy: destination === 'copy'}
  await dependencies.deliverInstructions(content, delivery)
  return toAppSecurityInstructionsJson(content, delivery)
}

async function instructionsDestination(
  options: SecurityCheckRenderOptions,
  dependencies: SecurityCheckRenderDependencies,
  agentCheckCount: number,
): Promise<AppSecurityInstructionsDestination> {
  if (options.skipInstructions) return 'nothing'
  if (options.yes) return 'print'
  if (!options.canPrompt) return 'nothing'
  return dependencies.selectInstructionsDestination(agentCheckCount)
}

function securityReportInput(result: SecurityCheckScan, verbose: boolean): SecurityReportInput {
  const {execution, artifacts, resolution, scanDirectories} = result
  return {
    scan: execution.scan,
    selection: resolution.selection,
    scanDirectories,
    engine: execution.engine,
    verbose,
    elapsedMilliseconds: execution.elapsedMilliseconds,
    commands: resolution.commands,
    deterministicFindingsPath: artifacts.deterministicFindingsPath,
    agentChecksPath: artifacts.agentChecksPath,
    agentCheckCount: execution.agentChecks.checks.length,
  }
}

function warnAboutIgnoredScanDirectories(ignoredScanDirectories: string[], format: SecurityCheckOutputFormat) {
  for (const directory of ignoredScanDirectories) {
    const headline = `${relativePath(cwd(), directory) || '.'} is ignored by Git, so only the files Git tracks in it are scanned.`
    if (format === 'json') {
      outputWarn(`${headline} Use --no-git-ignore to scan everything in it.`)
    } else {
      renderWarning({headline, body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.']})
    }
  }
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
    ['Have your coding agent run the agent checks'],
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

  const {appDirectory} = input.selection
  sections.push({
    title: 'Artifacts',
    body: {
      list: {
        items: [
          ['Deterministic findings:', {filePath: relativePath(appDirectory, input.deterministicFindingsPath)}],
          ['Agent security check instructions:', {filePath: relativePath(appDirectory, input.agentChecksPath)}],
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
  const item: InlineToken[] = [{bold: issue.title}, checkIdToken(issue.id), {filePath: location}]

  item.push({subdued: issue.message}, {subdued: `Fix: ${issue.fix.description}`})
  if (issue.fix.guide) {
    if (issue.fix.guide.startsWith('https://') || issue.fix.guide.startsWith('http://')) {
      item.push({link: {label: 'Guide', url: issue.fix.guide}})
    } else {
      item.push({subdued: `Guide: ${issue.fix.guide}`})
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
    checkIdToken(issue.id),
    `${count} ${count === 1 ? 'occurrence' : 'occurrences'} across ${files} ${files === 1 ? 'file' : 'files'}`,
    ...samples,
    ...(files > SAMPLE_FILE_COUNT ? [{subdued: `+${files - SAMPLE_FILE_COUNT} more files`}] : []),
  ]
}

/** The check ID, linked to the check's shopify.dev page when the catalog has one. */
function checkIdToken(checkId: string): InlineToken {
  const url = checkDocsUrl(checkId)
  return url ? {link: {label: checkId, url}} : {subdued: checkId}
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
