import {
  securityExitCode,
  executeAppSecurity,
  loadAppSecurityFindings,
  resolveAppSecurityRoot,
} from './app-security-api.js'
import {appSecurityArtifactPaths, readTrace, writeAppSecurityArtifacts} from './app-security-artifacts.js'
import {requireSecurityConfigFileName, resolveSecurityConfigFileName} from './app-security-config.js'
import deliverAppSecurityInstructions from './app-security-instructions.js'
import {
  formatAppSecurityCommand,
  resolveAppSecurityCommands,
  type AppSecurityCommands,
} from './app-security-commands.js'
import {hasRecordedAgentReview} from './app-security-engine/index.js'
import {encodeSecurityJson, toSecurityJson} from './security-json.js'
import {renderSecurityReport} from './security-output.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {
  AppSecurityArtifactPaths,
  ReadTraceResult,
  ResolvedAppSecurityArtifactPaths,
  WriteAppSecurityArtifactsOptions,
} from './app-security-artifacts.js'
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
  findingsPath?: string
  clean: boolean
}

export type AppSecurityInstructionsDestination = 'copy' | 'print' | 'nothing'

interface SecurityDependencies {
  resolveRoot(directory: string): string
  artifactPaths(appRoot: string): ResolvedAppSecurityArtifactPaths
  findingsFileExists(path: string): Promise<boolean>
  readTrace(path: string): Promise<ReadTraceResult>
  execute(options: {appRoot: string; configName?: string; findingsPath?: string}): Promise<AppSecurityExecution>
  writeArtifacts(
    execution: AppSecurityExecution,
    options: WriteAppSecurityArtifactsOptions,
  ): Promise<AppSecurityArtifactPaths>
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
  artifactPaths: appSecurityArtifactPaths,
  findingsFileExists: fileExists,
  readTrace,
  execute: async ({appRoot, configName, findingsPath}) => {
    const findings = findingsPath ? await loadAppSecurityFindings(findingsPath) : undefined
    return executeAppSecurity({
      appRoot,
      findings,
      configFileName: requireSecurityConfigFileName(appRoot, configName),
    })
  },
  writeArtifacts: writeAppSecurityArtifacts,
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
  if (options.json || options.skipInstructions || options.findingsPath) return 'nothing'
  if (options.yes) return 'print'
  if (!dependencies.canPrompt()) return 'nothing'
  return dependencies.selectInstructionsDestination()
}

function securityReportInput(
  execution: AppSecurityExecution,
  artifacts: AppSecurityArtifactPaths,
  verbose: boolean,
  commands: AppSecurityCommands,
): SecurityReportInput {
  return {
    scan: execution.scan,
    engine: execution.engine,
    verbose,
    elapsedMilliseconds: execution.elapsedMilliseconds,
    commands,
    tracePath: artifacts.tracePath,
    reviewPath: artifacts.reviewPath,
    reviewCheckCount: execution.operation === 'scan' ? execution.reviewPack.checks.length : undefined,
    findings: execution.operation === 'compile' ? execution.findings : undefined,
  }
}

async function assertCanStartScan(
  paths: ResolvedAppSecurityArtifactPaths,
  commands: AppSecurityCommands,
  dependencies: SecurityDependencies,
): Promise<void> {
  const traceResult = await dependencies.readTrace(paths.tracePath)
  if (traceResult.status === 'ok' && hasRecordedAgentReview(traceResult.trace)) {
    throw new AbortError(
      'App Security did not start a new scan.',
      `The existing trace contains agent review results:\n  ${paths.tracePath}\n\nUse the existing trace, or discard the current review and start over:\n  ${formatAppSecurityCommand(commands.clean)}`,
    )
  }

  if (await dependencies.findingsFileExists(paths.findingsPath)) {
    throw new AbortError(
      'App Security did not start a new scan.',
      `Agent findings exist at:\n  ${paths.findingsPath}\n\nCompile those findings:\n  ${formatAppSecurityCommand(commands.compile)}\n\nTo discard the current agent findings and start over:\n  ${formatAppSecurityCommand(commands.clean)}`,
    )
  }
}

export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.resolveRoot(options.directory)
  const commands = resolveAppSecurityCommands(appRoot, resolveSecurityConfigFileName(appRoot, options.configName))
  if (!options.findingsPath && !options.clean) {
    await assertCanStartScan(dependencies.artifactPaths(appRoot), commands, dependencies)
  }

  const execution = await dependencies.execute({
    appRoot,
    configName: options.configName,
    findingsPath: options.findingsPath,
  })
  const artifacts = await dependencies.writeArtifacts(execution, {clean: options.clean})

  if (options.json) {
    dependencies.output(encodeSecurityJson(toSecurityJson(execution)))
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
