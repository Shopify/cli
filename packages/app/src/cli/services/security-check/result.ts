import {
  appSecurityInstructions,
  deliverAppSecurityInstructions,
  renderAppSecurityInstructions,
} from '../app-security-instructions.js'
import {
  formatAppSecurityCommand,
  quoteShellArgument,
  shellForPlatform,
  type AppSecurityCommands,
} from '../app-security-commands.js'
import {MissingAppConfigurationError} from '../app-security-selection.js'
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

/** Shows how to repeat a run whose selection prompted, without the prompts. */
export function renderSecurityCheckPromptsTip(commands: AppSecurityCommands): void {
  renderInfo({
    headline: 'To skip these prompts next time, run:',
    body: [{command: formatAppSecurityCommand(commands.scan)}],
  })
}

/**
 * Presents the outcome of `securityCheck`: the gathering warnings, then the listed files, or the report followed by
 * the coding-agent instructions. Sets exit code 1 after the output when the scan breaches `--blocking`. Declining to
 * scan without app configuration aborts, as when there is none and prompts are off.
 */
export async function renderSecurityCheckResult(
  check: SecurityCheckOutcome,
  options: SecurityCheckPresentationOptions,
  dependencies: SecurityCheckPresenterDependencies = defaultDependencies,
): Promise<void> {
  if (check.kind === 'cancelled') throw new MissingAppConfigurationError(options.directory)

  if (check.kind === 'listed') {
    await renderGatheringWarnings(check)
    if (check.paths.length > 0) outputResult(check.paths.join('\n'))
    return
  }

  await renderGatheringWarnings(check.execution)
  renderSecurityReport(securityReportInput(check, options.verbose))

  const destination = await instructionsDestination(options, check.execution.agentChecks.checks.length, dependencies)
  if (destination !== 'nothing') {
    const instructions = appSecurityInstructions({
      appDirectory: check.selection.appDirectory,
      resultsKey: check.resultsKey,
      commands: check.commands,
      scanScope: check.scope,
    })
    const delivery = {copy: destination === 'copy'}
    await deliverAppSecurityInstructions(instructions, delivery)
    renderAppSecurityInstructions(instructions, delivery)
  }

  if (check.blocking.blockedChecks > 0) process.exitCode = 1
}

async function instructionsDestination(
  options: SecurityCheckPresentationOptions,
  agentCheckCount: number,
  dependencies: SecurityCheckPresenterDependencies,
): Promise<AppSecurityInstructionsDestination> {
  if (options.skipInstructions) return 'nothing'
  if (options.printInstructions) return 'print'
  if (!dependencies.canPrompt()) return 'nothing'
  return dependencies.selectInstructionsDestination(appSecurityInstructionsPrompt(agentCheckCount))
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
