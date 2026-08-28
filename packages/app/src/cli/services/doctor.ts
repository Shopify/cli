import {runAppDoctor} from './app-doctor-api.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import type {
  AppDoctorBlockingLevel,
  AppDoctorEngineMetadata,
  AppDoctorRunOptions,
  AppDoctorRunResult,
} from './app-doctor-api.js'

export interface DoctorOptions {
  directory: string
  json: boolean
  verbose: boolean
  blocking: AppDoctorBlockingLevel
  yes: boolean
  skipSkill: boolean
  findingsPath?: string
}

interface DoctorDependencies {
  runEngine(options: AppDoctorRunOptions): Promise<AppDoctorRunResult>
  canPrompt(): boolean
  confirmShowSkillInstructions(): Promise<boolean>
  output(content: string): void
  setExitCode(exitCode: number): void
}

export const appDoctorSkillInstructionsPrompt = {
  message: 'Show setup instructions for the Shopify App Doctor skill?',
  confirmationMessage: 'Yes, show instructions',
  cancellationMessage: 'No, skip instructions',
  defaultValue: false,
} as const

const defaultDependencies: DoctorDependencies = {
  runEngine: runAppDoctor,
  canPrompt: terminalSupportsPrompting,
  confirmShowSkillInstructions: () => renderConfirmationPrompt(appDoctorSkillInstructionsPrompt),
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

function skillSetupInstructions(engine: AppDoctorEngineMetadata): string {
  return [
    'Shopify App Doctor skill setup instructions',
    '',
    'Follow the Shopify AI Toolkit setup guide for your coding agent, then enable the shopify-app-doctor skill:',
    'https://github.com/Shopify/Shopify-AI-Toolkit',
    '',
    `Use a skill compatible with App Doctor engine ${engine.version} (ruleset ${engine.ruleset}).`,
    "These are instructions only; Shopify CLI didn't install or change your coding-agent configuration.",
  ].join('\n')
}

async function shouldShowSkillInstructions(options: DoctorOptions, dependencies: DoctorDependencies): Promise<boolean> {
  if (options.json || options.skipSkill) return false
  if (options.yes) return true
  if (!dependencies.canPrompt()) return false
  return dependencies.confirmShowSkillInstructions()
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

  if (await shouldShowSkillInstructions(options, dependencies)) {
    dependencies.output(skillSetupInstructions(result.engine))
  }

  if (result.exitCode !== 0) dependencies.setExitCode(result.exitCode)
}
