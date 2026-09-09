import {appDoctorArtifactPaths, readTrace, writeSubmission} from './app-doctor-artifacts.js'
import {resolveAppDoctorRoot} from './app-doctor-api.js'
import {
  buildSubmission,
  type AppDoctorSubmission,
  type BuildSubmissionOptions,
  type TraceV2,
} from './app-doctor-engine/index.js'
import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {resolveDoctorSubmitClientId} from './app-doctor-submit-target.js'
import {prepareSubmissionPayload} from './app-doctor-submission-payload.js'
import {renderDoctorSubmitConfirmation, renderDoctorSubmitFeedbackPrompt} from './doctor-submit-output.js'
import {defaultDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readStdinString, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import type {ReadTraceResult, ResolvedAppDoctorArtifactPaths} from './app-doctor-artifacts.js'
import type {SubmitAppDoctorScanOptions} from './app-doctor-submit-api.js'
import type {DoctorSubmitConfirmationAction, DoctorSubmitConfirmationInput} from './doctor-submit-output.js'
import type {DoctorSubmitResult, SubmitAppDoctorScanResult} from './doctor-submit-result.js'
import type {MinimalAppIdentifiers} from '../models/organization.js'
import type {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export interface DoctorSubmitOptions {
  directory: string
  json: boolean
  force: boolean
  dryRun: boolean
  clientId?: string
  configName?: string
  versionTag?: string
  feedback?: string
}

interface DoctorSubmitApp extends MinimalAppIdentifiers {
  title: string
}

interface DoctorSubmitAppContext {
  remoteApp: DoctorSubmitApp
  developerPlatformClient: DeveloperPlatformClient
}

export interface DoctorSubmitDependencies {
  findRoot(directory: string): string
  artifactPaths(appRoot: string): ResolvedAppDoctorArtifactPaths
  readTrace(path: string): Promise<ReadTraceResult>
  resolveClientId(options: {directory: string; clientId?: string; configName?: string}): Promise<string>
  fetchApp(clientId: string): Promise<DoctorSubmitAppContext>
  buildSubmission(trace: TraceV2, options: BuildSubmissionOptions): AppDoctorSubmission
  writeSubmission(appRoot: string, bytes: Buffer): Promise<void>
  canPrompt(): boolean
  readStdin(): Promise<string | undefined>
  promptForFeedback(): Promise<string>
  confirm(input: DoctorSubmitConfirmationInput): Promise<DoctorSubmitConfirmationAction>
  submitScan(options: SubmitAppDoctorScanOptions): Promise<SubmitAppDoctorScanResult>
  now(): string
  cliVersion: string
}

const defaultDependencies: DoctorSubmitDependencies = {
  findRoot: resolveAppDoctorRoot,
  artifactPaths: appDoctorArtifactPaths,
  readTrace,
  resolveClientId: resolveDoctorSubmitClientId,
  fetchApp: async (clientId) => {
    const remoteApp = await defaultDeveloperPlatformClient().appFromIdentifiers(clientId)
    if (!remoteApp) {
      throw new AbortError("Couldn't find an app with the selected client ID, or you don't have access to it.", null, [
        'Check `--client-id <client-id>` or `--config <name>` to select the intended app.',
        'Run `shopify auth login` with an account that has permission to access the app.',
      ])
    }
    return {remoteApp, developerPlatformClient: remoteApp.developerPlatformClient}
  },
  buildSubmission,
  writeSubmission,
  canPrompt: terminalSupportsPrompting,
  readStdin: readStdinString,
  promptForFeedback: renderDoctorSubmitFeedbackPrompt,
  confirm: renderDoctorSubmitConfirmation,
  submitScan: submitAppDoctorScan,
  now: () => new Date().toISOString(),
  cliVersion: CLI_KIT_VERSION,
}

async function resolveExplicitFeedback(
  options: DoctorSubmitOptions,
  dependencies: DoctorSubmitDependencies,
): Promise<string | undefined> {
  if (options.feedback === undefined) return undefined

  const feedback = options.feedback === '-' ? await dependencies.readStdin() : options.feedback
  if (feedback === undefined) {
    throw new AbortError('No piped stdin was provided for --feedback -.', null, [
      'Pipe feedback to the command or pass it directly with --feedback <value>.',
    ])
  }
  return feedback
}

export default async function doctorSubmit(
  options: DoctorSubmitOptions,
  dependencies: DoctorSubmitDependencies = defaultDependencies,
): Promise<DoctorSubmitResult> {
  if (!options.dryRun && !options.force && (options.json || !dependencies.canPrompt())) {
    throw new AbortError('Pass --force to submit without confirmation.')
  }

  const appRoot = dependencies.findRoot(options.directory)
  const paths = dependencies.artifactPaths(appRoot)
  const traceResult = await dependencies.readTrace(paths.tracePath)

  if (traceResult.status === 'missing') {
    throw new AbortError(`No App Doctor trace found in ${paths.artifactDirectory}.`, null, [
      `Run \`shopify app doctor --path ${options.directory}\` first, then submit.`,
    ])
  }
  if (traceResult.status === 'invalid') {
    throw new AbortError(`The App Doctor trace at ${paths.tracePath} is not valid.`, null, traceResult.errors)
  }

  const submittedAt = dependencies.now()
  const prepareFeedback = (feedback: string | undefined) =>
    prepareSubmissionPayload(
      dependencies.buildSubmission(traceResult.trace, {
        cliVersion: dependencies.cliVersion,
        submittedAt,
        versionTag: options.versionTag,
        feedback,
      }),
    )

  const feedback = await resolveExplicitFeedback(options, dependencies)
  let payload = prepareFeedback(feedback)

  if (options.dryRun) {
    // Bare dry runs only inspect the payload; explicit selections still need local validation.
    if (options.clientId !== undefined || options.configName !== undefined) {
      await dependencies.resolveClientId({
        directory: appRoot,
        clientId: options.clientId,
        configName: options.configName,
      })
    }
    await dependencies.writeSubmission(appRoot, payload.bytes)
    return {status: 'dry-run', payload: {path: paths.submissionPath, schemaVersion: payload.submission.schemaVersion}}
  }

  const clientId = await dependencies.resolveClientId({
    directory: appRoot,
    clientId: options.clientId,
    configName: options.configName,
  })
  await dependencies.writeSubmission(appRoot, payload.bytes)

  const {remoteApp, developerPlatformClient} = await dependencies.fetchApp(clientId)

  if (!options.force) {
    const confirmationAction = await dependencies.confirm({
      appTitle: remoteApp.title,
      submissionPath: paths.submissionPath,
      submission: payload.submission,
      canAddFeedback: options.feedback === undefined,
    })
    if (confirmationAction === 'cancel') return {status: 'cancelled'}

    if (confirmationAction === 'submit-with-feedback') {
      const enteredFeedback = await dependencies.promptForFeedback()
      payload = prepareFeedback(enteredFeedback)
      await dependencies.writeSubmission(appRoot, payload.bytes)
    }
  }

  const result = await dependencies.submitScan({
    app: remoteApp,
    payload,
    developerPlatformClient,
  })

  if (result.status === 'failed') return result
  return {
    status: 'submitted',
    payload: {path: paths.submissionPath, schemaVersion: payload.submission.schemaVersion},
    submittedAt: payload.submission.report.submitted_at,
    appTitle: remoteApp.title,
    clientId: remoteApp.apiKey,
  }
}
