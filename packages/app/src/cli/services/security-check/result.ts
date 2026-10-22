import {appSecurityCheckJsonOutputSchema, type AppSecurityCheckResult} from './types.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {
  appSecurityInstructions,
  ClipboardUnavailableError,
  deliverAppSecurityInstructions,
  renderAppSecurityInstructions,
} from '../app-security-instructions.js'
import {
  projectAppSecurityApp,
  projectAppSecurityBlocking,
  projectAppSecurityInstructions,
  projectAppSecurityPath,
  projectAppSecurityRelativePath,
  projectAppSecurityScanDirectory,
  projectAppSecurityScope,
} from '../app-security-json-output.js'
import {
  formatAppSecurityCommand,
  quoteShellArgument,
  shellForPlatform,
  type AppSecurityCommands,
} from '../app-security-commands.js'
import {missingAppConfigurationMessage} from '../app-security-selection.js'
import {renderSecurityReport} from '../security-output.js'
import {fileRealPath} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, relativePath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderInfo, renderSelectPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import type {RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'
import type {SecurityReportInput} from '../security-output.js'
import type {SecurityCheckOutcome} from '../security-check.js'

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

type ScannedSecurityCheck = Extract<SecurityCheckOutcome, {kind: 'scanned'}>
type ListedSecurityCheck = Extract<SecurityCheckOutcome, {kind: 'listed'}>
type OutputFormat = 'json' | 'text'

interface SecurityCheckPresentationOptions {
  /** The `--path` value, an absolute path. */
  directory: string
  verbose: boolean
  printInstructions: boolean
  skipInstructions: boolean
}

interface SecurityCheckPresenterDependencies {
  canPrompt(): boolean
  selectInstructionsDestination(
    prompt: RenderSelectPromptOptions<AppSecurityInstructionsDestination>,
  ): Promise<AppSecurityInstructionsDestination>
}

const defaultDependencies: SecurityCheckPresenterDependencies = {
  canPrompt: terminalSupportsPrompting,
  selectInstructionsDestination: (prompt) => renderSelectPrompt(prompt),
}

/** With `--json`, "print" means including the instructions in the result. */
export function appSecurityInstructionsPrompt(
  agentCheckCount: number,
  format: OutputFormat,
): RenderSelectPromptOptions<AppSecurityInstructionsDestination> {
  return {
    message: `${agentCheckCount} recommended agent ${agentCheckCount === 1 ? 'check' : 'checks'} available to complete your scan. How do you want to pass that prompt to your agent?`,
    choices:
      format === 'json'
        ? [
            {label: 'Include instructions in the JSON output and copy them to the clipboard', value: 'copy'},
            {label: 'Include instructions in the JSON output', value: 'print'},
            {label: 'Nothing', value: 'nothing'},
          ]
        : [
            {label: 'Copy instructions to the clipboard', value: 'copy'},
            {label: 'Print instructions to the terminal', value: 'print'},
            {label: 'Nothing', value: 'nothing'},
          ],
    defaultValue: 'copy',
  }
}

/** Shows how to repeat a run whose selection prompted, without the prompts. */
export function renderSecurityCheckPromptsTip(commands: AppSecurityCommands): void {
  renderInfo({
    headline: 'To skip these prompts next time, run:',
    body: [{command: formatAppSecurityCommand(commands.scan)}],
  })
}

/**
 * Presents the outcome of `securityCheck` as JSON, or in the terminal. Gathering warnings come first, on stderr. Then
 * the listed files, or the scan: in the terminal, its report followed by the coding-agent instructions; as JSON, the
 * instructions prompt followed by the result. Either way, sets exit code 1 after the output when the scan breaches
 * `--blocking`. Declining to scan without app configuration exits 0: as JSON, it's a cancelled result. In the
 * terminal, it shows the message that aborts the command when there's no app configuration and prompts are off.
 */
export async function renderSecurityCheckResult(
  check: SecurityCheckOutcome,
  options: SecurityCheckPresentationOptions,
  format: OutputFormat,
  dependencies: SecurityCheckPresenterDependencies = defaultDependencies,
): Promise<void> {
  if (check.kind === 'cancelled') {
    if (format === 'json') {
      outputResult(appSecurityCheckJsonOutputSchema.encode({status: 'cancelled'}))
    } else {
      const {headline, nextStep} = missingAppConfigurationMessage(options.directory)
      renderInfo({headline, body: nextStep})
    }
    return
  }

  if (check.kind === 'listed') {
    await renderGatheringWarnings(check)
    if (format === 'json') {
      outputResult(appSecurityCheckJsonOutputSchema.encode(appSecurityCheckFileListResult(check)))
    } else if (check.paths.length > 0) {
      outputResult(check.paths.join('\n'))
    }
    return
  }

  await renderGatheringWarnings(check.execution)
  if (format === 'json') {
    await renderScanAsJson(check, options, dependencies)
  } else {
    await renderScanInTerminal(check, options, dependencies)
  }

  if (check.blocking.blockedChecks > 0) process.exitCode = 1
}

async function renderScanInTerminal(
  check: ScannedSecurityCheck,
  options: SecurityCheckPresentationOptions,
  dependencies: SecurityCheckPresenterDependencies,
): Promise<void> {
  renderSecurityReport(securityReportInput(check, options.verbose))

  const destination = await instructionsDestination(check, options, 'text', dependencies)
  if (destination === 'nothing') return
  const instructions = scanInstructions(check)
  if (destination === 'print') {
    renderAppSecurityInstructions(instructions, {copy: false})
  } else if (await copyInstructions(instructions, 'text')) {
    renderAppSecurityInstructions(instructions, {copy: true})
  }
}

/** The result holds the instructions, so the prompt comes before it. It holds them even when they couldn't be copied. */
async function renderScanAsJson(
  check: ScannedSecurityCheck,
  options: SecurityCheckPresentationOptions,
  dependencies: SecurityCheckPresenterDependencies,
): Promise<void> {
  const destination = await instructionsDestination(check, options, 'json', dependencies)
  const instructions = destination === 'nothing' ? undefined : scanInstructions(check)
  const copied = instructions !== undefined && destination === 'copy' && (await copyInstructions(instructions, 'json'))
  outputResult(
    appSecurityCheckJsonOutputSchema.encode(
      appSecurityCheckScanResult(
        check,
        instructions === undefined ? undefined : projectAppSecurityInstructions(instructions, {copy: copied}),
      ),
    ),
  )
}

/**
 * Copies the instructions to the clipboard, and returns whether they're on it. The scan has already finished, so a
 * clipboard that isn't available only warns.
 */
async function copyInstructions(instructions: string, format: OutputFormat): Promise<boolean> {
  try {
    await deliverAppSecurityInstructions(instructions, {copy: true})
    return true
  } catch (error) {
    if (!(error instanceof ClipboardUnavailableError)) throw error
    renderWarning({
      headline: error.message,
      body:
        format === 'json'
          ? 'The result still includes them.'
          : ['Run the check again with', {command: '--print-instructions'}, 'to print them.'],
    })
    return false
  }
}

async function instructionsDestination(
  check: ScannedSecurityCheck,
  options: SecurityCheckPresentationOptions,
  format: OutputFormat,
  dependencies: SecurityCheckPresenterDependencies,
): Promise<AppSecurityInstructionsDestination> {
  if (options.skipInstructions) return 'nothing'
  if (options.printInstructions) return 'print'
  if (!dependencies.canPrompt()) return 'nothing'
  return dependencies.selectInstructionsDestination(
    appSecurityInstructionsPrompt(check.execution.agentChecks.checks.length, format),
  )
}

/** The instructions for the scan that just finished, which start from its results. */
function scanInstructions(check: ScannedSecurityCheck): string {
  return appSecurityInstructions({
    appDirectory: check.selection.appDirectory,
    resultsKey: check.resultsKey,
    commands: check.commands,
    scanScope: check.scope,
  })
}

function appSecurityCheckScanResult(
  check: ScannedSecurityCheck,
  instructions: ReturnType<typeof projectAppSecurityInstructions> | undefined,
): AppSecurityCheckResult {
  const {appDirectory} = check.selection
  const {resultsDirectory} = appSecurityArtifactPaths(appDirectory, check.resultsKey)
  return {
    status: 'success',
    valid: check.blocking.blockedChecks === 0,
    app: projectAppSecurityApp(check.selection),
    resultsDirectory: projectAppSecurityPath(resultsDirectory),
    deterministicFindingsPath: projectAppSecurityPath(check.artifacts.deterministicFindingsPath),
    agentChecksPath: projectAppSecurityPath(check.artifacts.agentChecksPath),
    scope: projectAppSecurityScope(check.scope),
    scanDirectories: check.scanDirectories.map((directory) => projectAppSecurityScanDirectory(appDirectory, directory)),
    agentCheckCount: check.execution.agentChecks.checks.length,
    blocking: projectAppSecurityBlocking(check.blocking),
    ...(instructions === undefined ? {} : {instructions}),
  }
}

/** Listed paths are relative to the app directory. */
function appSecurityCheckFileListResult(check: ListedSecurityCheck): AppSecurityCheckResult {
  const {appDirectory} = check.selection
  return {
    status: 'success',
    app: projectAppSecurityApp(check.selection),
    scope: projectAppSecurityScope(check.scope),
    scanDirectories: check.scanDirectories.map((directory) => projectAppSecurityScanDirectory(appDirectory, directory)),
    files: check.paths.map((path) => ({path: projectAppSecurityRelativePath(appDirectory, path)})),
  }
}

function securityReportInput(check: ScannedSecurityCheck, verbose: boolean): SecurityReportInput {
  const {execution, artifacts} = check
  return {
    scan: execution.scan,
    selection: check.selection,
    scanDirectories: check.scanDirectories,
    engine: execution.engine,
    verbose,
    elapsedMilliseconds: execution.elapsedMilliseconds,
    commands: check.commands,
    deterministicFindingsPath: artifacts.deterministicFindingsPath,
    agentChecksPath: artifacts.agentChecksPath,
    agentCheckCount: execution.agentChecks.checks.length,
  }
}

/** `--exclude` takes globs, so a directory name is escaped to match only that directory. */
export function literalGlobPattern(path: string): string {
  return path.replace(/[?*()[\]{}!#\\]/g, '\\$&')
}

async function renderGatheringWarnings(gathered: {ignoredScanDirectories: string[]; otherAppDirectories: string[]}) {
  if (gathered.ignoredScanDirectories.length === 0 && gathered.otherAppDirectories.length === 0) return
  // `--exclude` globs are matched from the real working directory, so paths are shown relative to it too.
  const workingDirectory = await fileRealPath(cwd())
  const displayPath = (directory: string) => relativePath(workingDirectory, directory) || '.'
  for (const directory of gathered.ignoredScanDirectories) {
    renderWarning({
      headline: `${displayPath(directory)} is ignored by Git, so only the files Git tracks in it are scanned.`,
      body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.'],
    })
  }
  for (const directory of gathered.otherAppDirectories) {
    const path = displayPath(directory)
    renderWarning({
      headline: `${path} holds another app's configuration, so its files are scanned as part of this app.`,
      // The directory name comes from the repository, so it's quoted before the user can paste it into a shell.
      body: [
        'Use',
        {command: `--exclude ${quoteShellArgument(literalGlobPattern(path), shellForPlatform())}`},
        'to leave it out.',
      ],
    })
  }
}
