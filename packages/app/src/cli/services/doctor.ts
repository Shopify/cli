import {runAppDoctor} from './app-doctor-api.js'
import {appDoctorInstructions} from './app-doctor-instructions.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import type {AppDoctorBlockingLevel, AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'

export interface DoctorOptions {
  directory: string
  json: boolean
  verbose: boolean
  blocking: AppDoctorBlockingLevel
  yes: boolean
  skipInstructions: boolean
  findingsPath?: string
}

interface DoctorDependencies {
  runEngine(options: AppDoctorRunOptions): Promise<AppDoctorRunResult>
  canPrompt(): boolean
  confirmShowInstructions(): Promise<boolean>
  output(content: string): void
  setExitCode(exitCode: number): void
}

export const appDoctorInstructionsPrompt = {
  message: 'Show instructions for handing the results to your coding agent?',
  confirmationMessage: 'Yes, show instructions',
  cancellationMessage: 'No, skip instructions',
  defaultValue: false,
} as const

const defaultDependencies: DoctorDependencies = {
  runEngine: runAppDoctor,
  canPrompt: terminalSupportsPrompting,
  confirmShowInstructions: () => renderConfirmationPrompt(appDoctorInstructionsPrompt),
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

async function shouldShowInstructions(options: DoctorOptions, dependencies: DoctorDependencies): Promise<boolean> {
  if (options.json || options.skipInstructions || options.findingsPath) return false
  if (options.yes) return true
  if (!dependencies.canPrompt()) return false
  return dependencies.confirmShowInstructions()
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

  if (await shouldShowInstructions(options, dependencies)) {
    dependencies.output(appDoctorInstructions(true))
  }

  if (result.exitCode !== 0) dependencies.setExitCode(result.exitCode)
}
