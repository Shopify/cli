import {securityExitCode, executeAppSecurity, listAppSecurityFiles} from './app-security-api.js'
import {writeCheckArtifacts} from './app-security-artifacts.js'
import {
  deliverAppSecurityInstructions,
  type AppSecurityInstructionsDelivery,
} from './app-security-instructions-output.js'
import {
  formatAppSecurityCommand,
  resolveAppSecurityCommands,
  type AppSecurityCommands,
} from './app-security-commands.js'
import {
  effectiveClientId,
  mergeScanDirectories,
  resolveAppSecuritySelection,
  resolveIncludeDirectories,
  resultsKey,
  type AppSecurityScanDirectory,
  type AppSecuritySelection,
  type AppSecuritySelectionOptions,
} from './app-security-selection.js'
import {securityCheckJsonOutputSchema, toSecurityCheckJson} from './security-check-json.js'
import {toAppSecurityInstructionsJson} from './security-instructions-json.js'
import {renderSecurityReport} from './security-output.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {outputInfo, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {cwd, relativePath} from '@shopify/cli-kit/node/path'
import {renderInfo, renderSelectPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import type {CheckArtifactPaths} from './app-security-artifacts.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanInput,
  ScanOptions,
} from './app-security-engine/index.js'
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
  includeDirs: ReadonlyArray<string>
  excludePatterns: ReadonlyArray<string>
  noGitIgnore: boolean
  /** Only resolve and gather: print the gathered paths and stop. */
  listFiles: boolean
}

/** What a run resolved, whether it scanned or only listed files. */
interface SecurityCheckResolution {
  selection: AppSecuritySelection
  resultsKey: string
  /** The commands that repeat this run, including its scope. */
  commands: AppSecurityCommands
}

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

interface SecurityDependencies {
  resolveSelection(options: AppSecuritySelectionOptions): Promise<AppSecuritySelection>
  execute(options: ScanInput & Required<ScanOptions>): Promise<AppSecurityExecution>
  listFiles(options: ScanInput & Required<ScanOptions>): Promise<{paths: string[]; ignoredScanDirectories: string[]}>
  writeArtifacts(
    appDirectory: string,
    resultsKey: string,
    artifacts: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
  ): Promise<CheckArtifactPaths>
  canPrompt(): boolean
  selectInstructionsDestination(agentCheckCount: number): Promise<AppSecurityInstructionsDestination>
  deliverInstructions(options: {
    appDirectory: string
    resultsKey: string
    copy: boolean
    json: boolean
    scanScope: AppSecurityScope
    commands: AppSecurityCommands
  }): Promise<AppSecurityInstructionsDelivery>
  output(content: string): void
  renderInfo(options: RenderAlertOptions): void
  renderWarning(options: RenderAlertOptions): void
  /** In JSON mode these emit diagnostic events on stderr instead of the banners. */
  outputInfo(message: string): void
  outputWarn(message: string): void
  renderReport(input: SecurityReportInput): void
  setExitCode(exitCode: number): void
  recordMetadata(fields: AppSecurityMetadata): Promise<void>
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

const defaultDependencies: SecurityDependencies = {
  resolveSelection: resolveAppSecuritySelection,
  execute: executeAppSecurity,
  listFiles: listAppSecurityFiles,
  writeArtifacts: writeCheckArtifacts,
  canPrompt: terminalSupportsPrompting,
  selectInstructionsDestination: (agentCheckCount) =>
    renderSelectPrompt(appSecurityInstructionsPrompt(agentCheckCount)),
  deliverInstructions: deliverAppSecurityInstructions,
  output: outputResult,
  renderInfo,
  renderWarning,
  outputInfo,
  outputWarn,
  renderReport: renderSecurityReport,
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
  recordMetadata: recordAppSecurityMetadata,
}

async function instructionsDestination(
  options: SecurityOptions,
  dependencies: SecurityDependencies,
  canPrompt: boolean,
  agentCheckCount: number,
): Promise<AppSecurityInstructionsDestination> {
  if (options.skipInstructions) return 'nothing'
  if (options.yes) return 'print'
  if (!canPrompt) return 'nothing'
  return dependencies.selectInstructionsDestination(agentCheckCount)
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

function warnAboutIgnoredScanDirectories(
  ignoredScanDirectories: string[],
  json: boolean,
  dependencies: SecurityDependencies,
) {
  for (const directory of ignoredScanDirectories) {
    const headline = `${relativePath(cwd(), directory) || '.'} is ignored by Git, so only the files Git tracks in it are scanned.`
    if (json) {
      dependencies.outputWarn(`${headline} Use --no-git-ignore to scan everything in it.`)
    } else {
      dependencies.renderWarning({headline, body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.']})
    }
  }
}

/**
 * Scans the app and replaces deterministic-findings.json and agent-checks.json. Scanning never reads or
 * changes the agent's recorded findings, so it's always safe to run again.
 *
 * With `listFiles`, it only resolves and gathers: it prints the gathered paths and writes nothing.
 * `directory` is the `--path` value, an absolute path.
 */
export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<SecurityCheckResolution> {
  // Resolved first so a mistyped directory fails before any prompt.
  const includeDirectories = await resolveIncludeDirectories(options.includeDirs)
  const canPrompt = !options.listFiles && dependencies.canPrompt()
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: canPrompt,
    validateClientIdFlag: true,
  })
  const {appDirectory} = selection
  const scope: AppSecurityScope = {
    include_dirs: [...options.includeDirs],
    excludes: [...options.excludePatterns],
    no_git_ignore: options.noGitIgnore,
  }
  const commands = resolveAppSecurityCommands(selection, options.directory, scope)
  const resolution = {selection, resultsKey: resultsKey(selection), commands}
  // Prompts are shown when no TOML was found and `--without-app-config` wasn't passed, or when `check` asked which TOML
  // to scan.
  const prompted = selection.kind === 'no-config' ? !options.withoutAppConfig : selection.appConfigFilePicked === true
  if (prompted) {
    const scanCommand = formatAppSecurityCommand(commands.scan)
    if (options.json) {
      dependencies.outputInfo(`To skip these prompts next time, run: ${scanCommand}`)
    } else {
      dependencies.renderInfo({headline: 'To skip these prompts next time, run:', body: [{command: scanCommand}]})
    }
  }
  const {scanDirectories, requestedScanDirectories} = mergeScanDirectories(appDirectory, includeDirectories)

  const scanOptions = {
    appDirectory,
    scanDirectories: scanDirectories.map(({directory}) => directory),
    requestedScanDirectories,
    appConfigFilePath: selection.kind === 'config' ? selection.appConfigFilePath : undefined,
    clientId: effectiveClientId(selection),
    includeDirs: options.includeDirs,
    excludePatterns: options.excludePatterns,
    noGitIgnore: options.noGitIgnore,
  }

  if (options.listFiles) {
    const {paths, ignoredScanDirectories} = await dependencies.listFiles(scanOptions)
    warnAboutIgnoredScanDirectories(ignoredScanDirectories, options.json, dependencies)
    if (options.json) {
      dependencies.output(securityCheckJsonOutputSchema.encode({files: paths}))
    } else if (paths.length > 0) {
      dependencies.output(paths.join('\n'))
    }
    return resolution
  }

  const execution = await dependencies.execute(scanOptions)
  warnAboutIgnoredScanDirectories(execution.ignoredScanDirectories, options.json, dependencies)
  await dependencies.recordMetadata({num_security_findings: execution.scan.issues.length})
  const artifacts = await dependencies.writeArtifacts(appDirectory, resultsKey(selection), {
    deterministicFindings: execution.deterministicFindings,
    agentChecks: execution.agentChecks,
  })

  const deliverChosenInstructions = async () => {
    const agentCheckCount = execution.agentChecks.checks.length
    const destination = await instructionsDestination(options, dependencies, canPrompt, agentCheckCount)
    if (destination === 'nothing') return null
    return dependencies.deliverInstructions({
      appDirectory,
      resultsKey: resultsKey(selection),
      copy: destination === 'copy',
      json: options.json,
      scanScope: scope,
      commands,
    })
  }

  if (options.json) {
    // The instructions are part of the JSON result, so they're chosen before it's printed.
    const instructions = await deliverChosenInstructions()
    dependencies.output(
      securityCheckJsonOutputSchema.encode(
        toSecurityCheckJson(
          execution,
          artifacts.agentChecksPath,
          selection,
          scanDirectories,
          instructions ? toAppSecurityInstructionsJson(instructions) : null,
        ),
      ),
    )
  } else {
    dependencies.renderReport(
      securityReportInput(execution, artifacts, options.verbose, commands, selection, scanDirectories),
    )
    await deliverChosenInstructions()
  }

  const exitCode = securityExitCode(execution, options.blocking)
  if (exitCode !== 0) dependencies.setExitCode(exitCode)
  return resolution
}
