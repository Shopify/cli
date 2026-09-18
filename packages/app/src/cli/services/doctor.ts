import {doctorExitCode, executeAppDoctor, loadAppDoctorFindings, resolveAppDoctorRoot} from './app-doctor-api.js'
import {appDoctorArtifactPaths, readTrace, writeAppDoctorArtifacts} from './app-doctor-artifacts.js'
import deliverAppDoctorInstructions from './app-doctor-instructions.js'
import {formatAppDoctorCommand, resolveAppDoctorCommands, type AppDoctorCommands} from './app-doctor-commands.js'
import {hasRecordedAgentReview} from './app-doctor-engine/index.js'
import {encodeDoctorJson, toDoctorJson} from './doctor-json.js'
import {renderDoctorReport} from './doctor-output.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {
  AppDoctorArtifactPaths,
  ReadTraceResult,
  ResolvedAppDoctorArtifactPaths,
  WriteAppDoctorArtifactsOptions,
} from './app-doctor-artifacts.js'
import type {AppDoctorBlockingLevel, AppDoctorExecution} from './app-doctor-api.js'
import type {DoctorReportInput} from './doctor-output.js'
import type {RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'

interface DoctorOptions {
  directory: string
  json: boolean
  verbose: boolean
  blocking: AppDoctorBlockingLevel
  yes: boolean
  skipInstructions: boolean
  findingsPath?: string
  clean: boolean
}

export type AppDoctorInstructionsDestination = 'copy' | 'print' | 'nothing'

interface DoctorDependencies {
  resolveRoot(directory: string): string
  artifactPaths(appRoot: string): ResolvedAppDoctorArtifactPaths
  findingsFileExists(path: string): Promise<boolean>
  readTrace(path: string): Promise<ReadTraceResult>
  execute(options: {appRoot: string; findingsPath?: string}): Promise<AppDoctorExecution>
  writeArtifacts(
    execution: AppDoctorExecution,
    options: WriteAppDoctorArtifactsOptions,
  ): Promise<AppDoctorArtifactPaths>
  canPrompt(): boolean
  selectInstructionsDestination(): Promise<AppDoctorInstructionsDestination>
  deliverInstructions(options: {
    directory: string
    copy: boolean
    scanComplete: boolean
    commands: AppDoctorCommands
  }): Promise<void>
  output(content: string): void
  renderReport(input: DoctorReportInput): void
  setExitCode(exitCode: number): void
}

export const appDoctorInstructionsPrompt: RenderSelectPromptOptions<AppDoctorInstructionsDestination> = {
  message: 'How would you like to hand the results to your coding agent?',
  choices: [
    {label: 'Copy instructions to the clipboard', value: 'copy'},
    {label: 'Print instructions to the terminal', value: 'print'},
    {label: 'Nothing', value: 'nothing'},
  ],
  defaultValue: 'copy',
}

const defaultDependencies: DoctorDependencies = {
  resolveRoot: resolveAppDoctorRoot,
  artifactPaths: appDoctorArtifactPaths,
  findingsFileExists: fileExists,
  readTrace,
  execute: async ({appRoot, findingsPath}) => {
    const findings = findingsPath ? await loadAppDoctorFindings(findingsPath) : undefined
    return executeAppDoctor({appRoot, findings})
  },
  writeArtifacts: writeAppDoctorArtifacts,
  canPrompt: terminalSupportsPrompting,
  selectInstructionsDestination: () => renderSelectPrompt(appDoctorInstructionsPrompt),
  deliverInstructions: deliverAppDoctorInstructions,
  output: outputResult,
  renderReport: renderDoctorReport,
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

async function instructionsDestination(
  options: DoctorOptions,
  dependencies: DoctorDependencies,
): Promise<AppDoctorInstructionsDestination> {
  if (options.json || options.skipInstructions || options.findingsPath) return 'nothing'
  if (options.yes) return 'print'
  if (!dependencies.canPrompt()) return 'nothing'
  return dependencies.selectInstructionsDestination()
}

function doctorReportInput(
  execution: AppDoctorExecution,
  artifacts: AppDoctorArtifactPaths,
  verbose: boolean,
  commands: AppDoctorCommands,
): DoctorReportInput {
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
  paths: ResolvedAppDoctorArtifactPaths,
  commands: AppDoctorCommands,
  dependencies: DoctorDependencies,
): Promise<void> {
  const traceResult = await dependencies.readTrace(paths.tracePath)
  if (traceResult.status === 'ok' && hasRecordedAgentReview(traceResult.trace)) {
    throw new AbortError(
      'App Doctor did not start a new scan.',
      `The existing trace contains agent review results:\n  ${paths.tracePath}\n\nUse the existing trace, or discard the current review and start over:\n  ${formatAppDoctorCommand(commands.clean)}`,
    )
  }

  if (await dependencies.findingsFileExists(paths.findingsPath)) {
    throw new AbortError(
      'App Doctor did not start a new scan.',
      `Agent findings exist at:\n  ${paths.findingsPath}\n\nCompile those findings:\n  ${formatAppDoctorCommand(commands.compile)}\n\nTo discard the current agent findings and start over:\n  ${formatAppDoctorCommand(commands.clean)}`,
    )
  }
}

export default async function doctor(
  options: DoctorOptions,
  dependencies: DoctorDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.resolveRoot(options.directory)
  const commands = resolveAppDoctorCommands(appRoot)
  if (!options.findingsPath && !options.clean) {
    await assertCanStartScan(dependencies.artifactPaths(appRoot), commands, dependencies)
  }

  const execution = await dependencies.execute({appRoot, findingsPath: options.findingsPath})
  const artifacts = await dependencies.writeArtifacts(execution, {clean: options.clean})

  if (options.json) {
    dependencies.output(encodeDoctorJson(toDoctorJson(execution)))
  } else {
    dependencies.renderReport(doctorReportInput(execution, artifacts, options.verbose, commands))
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

  const exitCode = doctorExitCode(execution, options.blocking)
  if (exitCode !== 0) dependencies.setExitCode(exitCode)
}
