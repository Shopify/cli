import {doctorExitCode, executeAppDoctor, loadAppDoctorFindings, resolveAppDoctorRoot} from './app-doctor-api.js'
import {writeAppDoctorArtifacts} from './app-doctor-artifacts.js'
import deliverAppDoctorInstructions from './app-doctor-instructions.js'
import {resolveAppDoctorCommands, type AppDoctorCommands} from './app-doctor-commands.js'
import {encodeDoctorJson, toDoctorJson} from './doctor-json.js'
import {renderDoctorReport} from './doctor-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {AppDoctorArtifactPaths} from './app-doctor-artifacts.js'
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
}

export type AppDoctorInstructionsDestination = 'copy' | 'print' | 'nothing'

interface DoctorDependencies {
  execute(options: {directory: string; findingsPath?: string}): Promise<AppDoctorExecution>
  writeArtifacts(execution: AppDoctorExecution): Promise<AppDoctorArtifactPaths>
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
  execute: async ({directory, findingsPath}) => {
    const appRoot = resolveAppDoctorRoot(directory)
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

export default async function doctor(
  options: DoctorOptions,
  dependencies: DoctorDependencies = defaultDependencies,
): Promise<void> {
  const execution = await dependencies.execute({
    directory: options.directory,
    findingsPath: options.findingsPath,
  })
  const artifacts = await dependencies.writeArtifacts(execution)
  const commands = resolveAppDoctorCommands(execution.appRoot)

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
