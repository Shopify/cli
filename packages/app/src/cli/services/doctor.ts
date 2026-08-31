import {runAppDoctor} from './app-doctor-api.js'
import deliverAppDoctorInstructions from './app-doctor-instructions.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {AppDoctorBlockingLevel, AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'
import type {RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'

export interface DoctorOptions {
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
  setExitCode: (exitCode) => {
    process.exitCode = exitCode
  },
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function formatDoctorOutput(result: AppDoctorRunResult, json: boolean): string {
  if (!json) {
    return `${result.output.trimEnd()}\n\nEngine: ${result.engine.name} ${result.engine.version}\nRuleset: ${result.engine.ruleset}`
  }

  const report: unknown = JSON.parse(result.output)
  const reportWithEngine = isJsonObject(report)
    ? {...report, engine: {...(isJsonObject(report.engine) ? report.engine : {}), ...result.engine}}
    : {engine: result.engine, result: report}

  return JSON.stringify(reportWithEngine, null, 2)
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

export default async function doctor(
  options: DoctorOptions,
  dependencies: DoctorDependencies = defaultDependencies,
): Promise<void> {
  const result = await dependencies.runEngine({
    directory: options.directory,
    format: options.json ? 'json' : 'human',
    verbose: options.verbose,
    blocking: options.blocking,
    findingsPath: options.findingsPath,
  })

  dependencies.output(formatDoctorOutput(result, options.json))

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
