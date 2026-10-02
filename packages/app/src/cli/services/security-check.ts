import {securityExitCode, executeAppSecurity} from './app-security-api.js'
import {writeCheckArtifacts} from './app-security-artifacts.js'
import deliverAppSecurityInstructions from './app-security-instructions.js'
import {
  formatAppSecurityCommand,
  resolveAppSecurityCommands,
  type AppSecurityCommands,
} from './app-security-commands.js'
import {
  effectiveClientId,
  resolveAppSecuritySelection,
  resultsKey,
  selectedConfigFileName,
  type AppSecurityScanDirectory,
  type AppSecuritySelection,
} from './app-security-selection.js'
import {encodeSecurityJson, toSecurityJson} from './security-json.js'
import {renderSecurityReport} from './security-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {cwd, relativePath} from '@shopify/cli-kit/node/path'
import {renderInfo, renderSelectPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import type {CheckArtifactPaths} from './app-security-artifacts.js'
import type {AgentChecks, DeterministicFindingsDocument, ScanInput, ScanOptions} from './app-security-engine/index.js'
import type {AppSecurityBlockingLevel, AppSecurityExecution} from './app-security-api.js'
import type {SecurityReportInput} from './security-output.js'
import type {RenderAlertOptions, RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'

interface SecurityOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig: boolean
  json: boolean
  verbose: boolean
  blocking: AppSecurityBlockingLevel
  yes: boolean
  skipInstructions: boolean
  excludePatterns: ReadonlyArray<string>
  noGitIgnore: boolean
}

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

interface SecurityDependencies {
  resolveSelection(options: {
    path: string
    config?: string
    clientId?: string
    withoutAppConfig: boolean
    allowPrompts: boolean
  }): Promise<AppSecuritySelection>
  execute(options: ScanInput & Required<ScanOptions>): Promise<AppSecurityExecution>
  writeArtifacts(
    appDirectory: string,
    resultsKey: string,
    artifacts: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
  ): Promise<CheckArtifactPaths>
  canPrompt(): boolean
  selectInstructionsDestination(): Promise<AppSecurityInstructionsDestination>
  deliverInstructions(options: {
    appDirectory: string
    resultsKey: string
    copy: boolean
    scanComplete: boolean
    commands: AppSecurityCommands
  }): Promise<void>
  output(content: string): void
  renderInfo(options: RenderAlertOptions): void
  renderWarning(options: RenderAlertOptions): void
  renderReport(input: SecurityReportInput): void
  setExitCode(exitCode: number): void
}

export const appSecurityInstructionsPrompt: RenderSelectPromptOptions<AppSecurityInstructionsDestination> = {
  message: 'How would you like to hand the results to your coding agent?',
  choices: [
    {label: 'Copy instructions to the clipboard', value: 'copy'},
    {label: 'Print instructions to the terminal', value: 'print'},
    {label: 'Nothing', value: 'nothing'},
  ],
  defaultValue: 'copy',
}

const defaultDependencies: SecurityDependencies = {
  resolveSelection: resolveAppSecuritySelection,
  execute: executeAppSecurity,
  writeArtifacts: writeCheckArtifacts,
  canPrompt: terminalSupportsPrompting,
  selectInstructionsDestination: () => renderSelectPrompt(appSecurityInstructionsPrompt),
  deliverInstructions: deliverAppSecurityInstructions,
  output: outputResult,
  renderInfo,
  renderWarning,
  renderReport: renderSecurityReport,
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

async function instructionsDestination(
  options: SecurityOptions,
  dependencies: SecurityDependencies,
  canPrompt: boolean,
): Promise<AppSecurityInstructionsDestination> {
  if (options.json || options.skipInstructions) return 'nothing'
  if (options.yes) return 'print'
  if (!canPrompt) return 'nothing'
  return dependencies.selectInstructionsDestination()
}

function securityReportInput(
  execution: AppSecurityExecution,
  artifacts: CheckArtifactPaths,
  verbose: boolean,
  commands: AppSecurityCommands,
  selection: AppSecuritySelection,
  scanDirectories: AppSecurityScanDirectory[],
): SecurityReportInput {
  return {
    scan: execution.scan,
    selection,
    scanDirectories,
    engine: execution.engine,
    verbose,
    elapsedMilliseconds: execution.elapsedMilliseconds,
    commands,
    deterministicFindingsPath: artifacts.deterministicFindingsPath,
    agentChecksPath: artifacts.agentChecksPath,
    agentCheckCount: execution.agentChecks.checks.length,
  }
}

/**
 * Scans the app and replaces deterministic-findings.json and agent-checks.json. Scanning never reads or
 * changes the agent's recorded findings, so it's always safe to run again.
 */
export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<void> {
  const canPrompt = !options.json && dependencies.canPrompt()
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: canPrompt,
  })
  const {appDirectory} = selection
  const commands = resolveAppSecurityCommands(
    appDirectory,
    selectedConfigFileName(selection),
    options.excludePatterns,
    options.noGitIgnore,
  )
  // The prompt is only shown when no TOML was found and `--without-app-config` wasn't passed.
  if (selection.kind === 'no-config' && !options.withoutAppConfig) {
    dependencies.renderInfo({
      headline: 'To skip these prompts next time, run:',
      body: [{command: formatAppSecurityCommand(commands.scan)}],
    })
  }
  const scanDirectories: AppSecurityScanDirectory[] = [{directory: appDirectory, origin: 'app_directory'}]

  const execution = await dependencies.execute({
    appDirectory,
    scanDirectories: scanDirectories.map(({directory}) => directory),
    appConfigFilePath: selection.kind === 'config' ? selection.appConfigFilePath : undefined,
    clientId: effectiveClientId(selection),
    excludePatterns: options.excludePatterns,
    noGitIgnore: options.noGitIgnore,
  })
  for (const directory of execution.ignoredScanDirectories) {
    dependencies.renderWarning({
      headline: `${relativePath(cwd(), directory) || '.'} is ignored by Git, so only the files Git tracks in it are scanned.`,
      body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.'],
    })
  }
  const artifacts = await dependencies.writeArtifacts(appDirectory, resultsKey(selection), {
    deterministicFindings: execution.deterministicFindings,
    agentChecks: execution.agentChecks,
  })

  if (options.json) {
    dependencies.output(
      encodeSecurityJson(toSecurityJson(execution, artifacts.agentChecksPath, selection, scanDirectories)),
    )
  } else {
    dependencies.renderReport(
      securityReportInput(execution, artifacts, options.verbose, commands, selection, scanDirectories),
    )
  }

  const destination = await instructionsDestination(options, dependencies, canPrompt)
  if (destination !== 'nothing') {
    await dependencies.deliverInstructions({
      appDirectory,
      resultsKey: resultsKey(selection),
      copy: destination === 'copy',
      scanComplete: true,
      commands,
    })
  }

  const exitCode = securityExitCode(execution, options.blocking)
  if (exitCode !== 0) dependencies.setExitCode(exitCode)
}
