import {
  securityExitCode,
  executeAppSecurity,
  loadAppSecurityFindings,
  resolveAppSecurityRoot,
} from './app-security-api.js'
import {
  appSecurityArtifactPaths,
  readAppSecurityArtifactState,
  readTrace,
  withTracePublicationLock,
  writeAppSecurityArtifacts,
} from './app-security-artifacts.js'
import {requireSecurityConfigFileName} from './app-security-config.js'
import deliverAppSecurityInstructions from './app-security-instructions.js'
import {
  formatAppSecurityCommand,
  resolveAppSecurityCommands,
  type AppSecurityCommands,
} from './app-security-commands.js'
import {hasRecordedAgentReview} from './app-security-engine/index.js'
import {encodeSecurityJson, toSecurityJson} from './security-json.js'
import {renderSecurityReport} from './security-output.js'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {outputDebug, outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderConfirmationPrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import type {
  AppSecurityArtifactPaths,
  AppSecurityArtifactState,
  ReadTraceResult,
  ResolvedAppSecurityArtifactPaths,
  WriteAppSecurityArtifactsOptions,
} from './app-security-artifacts.js'
import type {AppSecurityBlockingLevel, AppSecurityExecution} from './app-security-api.js'
import type {SecurityReportInput} from './security-output.js'
import type {RenderConfirmationPromptOptions, RenderSelectPromptOptions} from '@shopify/cli-kit/node/ui'

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
  readArtifactState(paths: ResolvedAppSecurityArtifactPaths): Promise<AppSecurityArtifactState>
  execute(options: {appRoot: string; configFileName: string; findingsPath?: string}): Promise<AppSecurityExecution>
  withPublicationLock(
    appRoot: string,
    publish: () => Promise<AppSecurityArtifactPaths>,
  ): Promise<AppSecurityArtifactPaths>
  writeArtifacts(
    execution: AppSecurityExecution,
    options: WriteAppSecurityArtifactsOptions,
  ): Promise<AppSecurityArtifactPaths>
  canPrompt(): boolean
  confirmDiscardReview(details: string): Promise<boolean>
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

export function appSecurityDiscardReviewPrompt(details: string): RenderConfirmationPromptOptions {
  return {
    message: 'Discard the current App Security review and start a new scan?',
    infoMessage: {title: {color: 'red', text: "Discarding the current review can't be undone."}, body: details},
    confirmationMessage: 'Yes, discard and start a new scan',
    cancellationMessage: 'No, cancel',
    defaultValue: false,
  }
}

const defaultDependencies: SecurityDependencies = {
  resolveRoot: resolveAppSecurityRoot,
  artifactPaths: appSecurityArtifactPaths,
  findingsFileExists: fileExists,
  readTrace,
  readArtifactState: readAppSecurityArtifactState,
  execute: async ({appRoot, configFileName, findingsPath}) => {
    const findings = findingsPath ? await loadAppSecurityFindings(findingsPath) : undefined
    return executeAppSecurity({appRoot, findings, configFileName})
  },
  withPublicationLock: (appRoot, publish) => withTracePublicationLock(appRoot, publish),
  writeArtifacts: writeAppSecurityArtifacts,
  canPrompt: terminalSupportsPrompting,
  confirmDiscardReview: (details) => renderConfirmationPrompt(appSecurityDiscardReviewPrompt(details)),
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

interface ProtectedReview {
  // Describes the review work a new scan would discard. Shown both in the prompt and in the error.
  details: string
  // Recovery guidance shown when the command stops without prompting.
  abortGuidance: string
  // Shown in the prompt when discarding isn't the only way forward.
  promptGuidance?: string
}

async function findProtectedReview(
  paths: ResolvedAppSecurityArtifactPaths,
  commands: AppSecurityCommands,
  dependencies: SecurityDependencies,
): Promise<ProtectedReview | undefined> {
  const traceResult = await dependencies.readTrace(paths.tracePath)
  const findingsExist = await dependencies.findingsFileExists(paths.findingsPath)
  const cleanCommand = formatAppSecurityCommand(commands.clean)
  const findingsNotice = findingsExist ? `\n\nAgent findings will also be deleted:\n  ${paths.findingsPath}` : ''

  if (traceResult.status === 'ok' && hasRecordedAgentReview(traceResult.trace)) {
    return {
      details: `The existing trace contains agent review results:\n  ${paths.tracePath}${findingsNotice}`,
      abortGuidance: `Use the existing trace, or discard the current review and start over:\n  ${cleanCommand}`,
    }
  }

  // A trace that fails validation may hold agent review results in a form this CLI can't read (for example, a
  // newer schema or a trace over the size limit), so only a validated scan-only trace may be replaced.
  if (traceResult.status === 'invalid') {
    // Validation errors describe the trace schema, which users can't act on, so they're only shown with --verbose.
    outputDebug(`App Security trace validation errors:\n${traceResult.errors.join('\n')}`)
    return {
      details: `Shopify CLI can't validate the existing trace, so it can't confirm whether it contains agent review results:\n  ${paths.tracePath}${findingsNotice}`,
      abortGuidance: `To discard the current review and start over:\n  ${cleanCommand}`,
    }
  }

  if (findingsExist) {
    const compileCommand = formatAppSecurityCommand(commands.compile)
    return {
      details: `Agent findings exist at:\n  ${paths.findingsPath}`,
      abortGuidance: `Compile those findings:\n  ${compileCommand}\n\nTo discard the current agent findings and start over:\n  ${cleanCommand}`,
      // The agent may still be writing its findings, so compiling is left to the user rather than offered as a choice.
      promptGuidance: `If your coding agent is still reviewing, cancel.\nTo compile these findings instead, cancel and run:\n  ${compileCommand}`,
    }
  }

  return undefined
}

/**
 * Returns whether a new scan must clean existing artifacts. When review work would be discarded, interactive
 * users confirm the discard; otherwise the scan stops with recovery guidance.
 */
async function confirmCleanForNewScan(
  options: SecurityOptions,
  paths: ResolvedAppSecurityArtifactPaths,
  commands: AppSecurityCommands,
  dependencies: SecurityDependencies,
): Promise<boolean> {
  const protectedReview = await findProtectedReview(paths, commands, dependencies)
  if (!protectedReview) return false

  if (options.json || !dependencies.canPrompt()) {
    throw new AbortError(
      'App Security did not start a new scan.',
      `${protectedReview.details}\n\n${protectedReview.abortGuidance}`,
    )
  }

  const {details, promptGuidance} = protectedReview
  if (await dependencies.confirmDiscardReview(promptGuidance ? `${details}\n\n${promptGuidance}` : details)) return true
  throw new AbortSilentError()
}

/**
 * Stops publication when another run changed the artifacts after this one started, so its results can't silently
 * replace newer review work. Must run while holding the trace publication lock.
 */
async function assertArtifactsUnchanged(
  startingState: AppSecurityArtifactState,
  options: SecurityOptions,
  paths: ResolvedAppSecurityArtifactPaths,
  commands: AppSecurityCommands,
  dependencies: SecurityDependencies,
): Promise<void> {
  const currentState = await dependencies.readArtifactState(paths)
  const traceUnchanged = currentState.traceDigest === startingState.traceDigest

  if (options.findingsPath) {
    // Compilation reads its findings document up front, so only a trace replaced by another run matters.
    if (traceUnchanged) return
    // The default compile command names the default findings file, which may not be the one this run compiled.
    const compileCommand = {...commands.scan, args: [...commands.scan.args, '--findings', options.findingsPath]}
    throw new AbortError(
      "App Security didn't save the compiled findings.",
      `The trace changed while the findings were being compiled:\n  ${paths.tracePath}\n\nCompile the findings again:\n  ${formatAppSecurityCommand(compileCommand)}`,
    )
  }

  if (traceUnchanged && currentState.findingsExist === startingState.findingsExist) return
  throw new AbortError(
    "App Security didn't save the new scan results.",
    `App Security artifacts changed while this scan was running:\n  ${paths.artifactDirectory}\n\nRun the scan again to check the latest results:\n  ${formatAppSecurityCommand(commands.scan)}\n\nTo discard the current review and start over:\n  ${formatAppSecurityCommand(commands.clean)}`,
  )
}

export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.resolveRoot(options.directory)
  const configFileName = requireSecurityConfigFileName(appRoot, options.configName)
  const commands = resolveAppSecurityCommands(appRoot, configFileName)
  const paths = dependencies.artifactPaths(appRoot)
  // An explicit --clean discards whatever exists at publication time. Every other run, including one whose discard
  // was confirmed at the prompt, only replaces the state it started from. The snapshot precedes the prompt so a
  // confirmation can't cover work that appeared after it was shown.
  const startingState = options.clean ? undefined : await dependencies.readArtifactState(paths)
  const startsNewScan = !options.findingsPath && !options.clean
  const clean = startsNewScan ? await confirmCleanForNewScan(options, paths, commands, dependencies) : options.clean

  // Scanning stays outside the lock; only the final check and publication hold it.
  const execution = await dependencies.execute({
    appRoot,
    configFileName,
    findingsPath: options.findingsPath,
  })
  const artifacts = await dependencies.withPublicationLock(appRoot, async () => {
    if (startingState) await assertArtifactsUnchanged(startingState, options, paths, commands, dependencies)
    return dependencies.writeArtifacts(execution, {clean})
  })

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
