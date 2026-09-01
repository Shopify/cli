import {runAppDoctor} from './app-doctor-api.js'
import deliverAppDoctorInstructions from './app-doctor-instructions.js'
import {formatDoctorJson, renderDoctorReport} from './doctor-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {AppDoctorBlockingLevel, AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'
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
  runEngine(options: AppDoctorRunOptions): Promise<AppDoctorRunResult>
  canPrompt(): boolean
  selectInstructionsDestination(): Promise<AppDoctorInstructionsDestination>
  deliverInstructions(options: {directory: string; copy: boolean; scanComplete: boolean}): Promise<void>
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
  runEngine: runAppDoctor,
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

function doctorReportInput(result: AppDoctorRunResult, verbose: boolean): DoctorReportInput {
  return {
    scan: result.scan,
    engine: result.engine,
    verbose,
    elapsedMilliseconds: result.elapsedMilliseconds,
    tracePath: result.tracePath,
    reviewPath: result.reviewPath,
    reviewCheckCount: result.reviewCheckCount,
    findings: result.findings,
  }
}

export default async function doctor(
  options: DoctorOptions,
  dependencies: DoctorDependencies = defaultDependencies,
): Promise<void> {
  const result = await dependencies.runEngine({
    directory: options.directory,
    blocking: options.blocking,
    findingsPath: options.findingsPath,
  })

  if (options.json) {
    dependencies.output(formatDoctorJson(result.jsonReport, result.engine))
  } else {
    dependencies.renderReport(doctorReportInput(result, options.verbose))
  }

  const destination = await instructionsDestination(options, dependencies)
  if (destination !== 'nothing') {
    await dependencies.deliverInstructions({
      directory: options.directory,
      copy: destination === 'copy',
      scanComplete: true,
    })
  }

  if (result.exitCode !== 0) dependencies.setExitCode(result.exitCode)
}
