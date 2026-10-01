import {securityExitCode, executeAppSecurity, resolveAppSecurityRoot} from './app-security-api.js'
import {writeCheckArtifacts} from './app-security-artifacts.js'
import {requireSecurityConfigFileName} from './app-security-config.js'
import deliverAppSecurityInstructions from './app-security-instructions.js'
import {resolveAppSecurityCommands, type AppSecurityCommands} from './app-security-commands.js'
import {encodeSecurityJson, toSecurityJson} from './security-json.js'
import {renderSecurityReport} from './security-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {AppSecurityArtifactPaths} from './app-security-artifacts.js'
import type {AgentChecks, DeterministicFindingsDocument} from './app-security-engine/index.js'
import type {AppSecurityBlockingLevel, AppSecurityExecution} from './app-security-api.js'
import type {SecurityReportInput} from './security-output.js'
import type {RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'

interface SecurityOptions {
  directory: string
  configName?: string
  json: boolean
  verbose: boolean
  blocking: AppSecurityBlockingLevel
  yes: boolean
  skipInstructions: boolean
  ignorePatterns: ReadonlyArray<string>
}

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

type CheckArtifactPaths = Pick<AppSecurityArtifactPaths, 'deterministicFindingsPath' | 'agentChecksPath'>

interface SecurityDependencies {
  resolveRoot(directory: string): string
  execute(options: {
    appRoot: string
    configFileName: string
    ignorePatterns: ReadonlyArray<string>
  }): Promise<AppSecurityExecution>
  writeArtifacts(
    appRoot: string,
    artifacts: {artifact: DeterministicFindingsDocument; agentChecks: AgentChecks},
  ): Promise<CheckArtifactPaths>
  canPrompt(): boolean
  selectInstructionsDestination(): Promise<AppSecurityInstructionsDestination>
  deliverInstructions(options: {
    directory: string
    copy: boolean
    scanComplete: boolean
    commands: AppSecurityCommands
  }): Promise<void>
  output(content: string): void
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
  resolveRoot: resolveAppSecurityRoot,
  execute: executeAppSecurity,
  writeArtifacts: writeCheckArtifacts,
  canPrompt: terminalSupportsPrompting,
  selectInstructionsDestination: () => renderSelectPrompt(appSecurityInstructionsPrompt),
  deliverInstructions: deliverAppSecurityInstructions,
  output: outputResult,
  renderReport: renderSecurityReport,
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

async function instructionsDestination(
  options: SecurityOptions,
  dependencies: SecurityDependencies,
): Promise<AppSecurityInstructionsDestination> {
  if (options.json || options.skipInstructions) return 'nothing'
  if (options.yes) return 'print'
  if (!dependencies.canPrompt()) return 'nothing'
  return dependencies.selectInstructionsDestination()
}

function securityReportInput(
  execution: AppSecurityExecution,
  artifacts: CheckArtifactPaths,
  verbose: boolean,
  commands: AppSecurityCommands,
): SecurityReportInput {
  return {
    scan: execution.scan,
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
 * Scans the app and replaces deterministic-findings.json and agent-checks.json. Scanning never reads or changes the agent's
 * recorded findings, so it's always safe to run again.
 */
export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.resolveRoot(options.directory)
  const configFileName = requireSecurityConfigFileName(appRoot, options.configName)
  const commands = resolveAppSecurityCommands(appRoot, configFileName, options.ignorePatterns)

  const execution = await dependencies.execute({appRoot, configFileName, ignorePatterns: options.ignorePatterns})
  const artifacts = await dependencies.writeArtifacts(appRoot, {
    artifact: execution.artifact,
    agentChecks: execution.agentChecks,
  })

  if (options.json) {
    dependencies.output(encodeSecurityJson(toSecurityJson(execution, artifacts.agentChecksPath)))
  } else {
    dependencies.renderReport(securityReportInput(execution, artifacts, options.verbose, commands))
  }

  const destination = await instructionsDestination(options, dependencies)
  if (destination !== 'nothing') {
    await dependencies.deliverInstructions({
      directory: options.directory,
      copy: destination === 'copy',
      scanComplete: true,
      commands,
    })
  }

  const exitCode = securityExitCode(execution, options.blocking)
  if (exitCode !== 0) dependencies.setExitCode(exitCode)
}
