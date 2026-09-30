import {appSecurityArtifactPaths, readDeterministicFindings, writeSubmission} from './app-security-artifacts.js'
import {resolveAppSecurityRoot} from './app-security-api.js'
import {
  buildSubmission,
  containsUnredactedSecret,
  type AppSecuritySubmission,
  type BuildSubmissionOptions,
  type DeterministicFindingsDocument,
} from './app-security-engine/index.js'
import {submitAppSecurityScan} from './app-security-submit-api.js'
import {resolveSecuritySubmitClientId} from './app-security-submit-target.js'
import {prepareSubmissionPayload} from './app-security-submission-payload.js'
import {renderSecuritySubmitConfirmation, renderSecuritySubmitFeedbackPrompt} from './security-submit-output.js'
import {defaultDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readStdinString, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import type {AppSecurityArtifactPaths, ReadArtifactResult} from './app-security-artifacts.js'
import type {SubmitAppSecurityScanOptions} from './app-security-submit-api.js'
import type {SecuritySubmitConfirmationAction, SecuritySubmitConfirmationInput} from './security-submit-output.js'
import type {SecuritySubmitResult, SubmitAppSecurityScanResult} from './security-submit-result.js'
import type {MinimalAppIdentifiers} from '../models/organization.js'
import type {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export interface SecuritySubmitOptions {
  directory: string
  json: boolean
  force: boolean
  dryRun: boolean
  clientId?: string
  configName?: string
  versionTag?: string
  feedback?: string
}

interface SecuritySubmitApp extends MinimalAppIdentifiers {
  title: string
}

interface SecuritySubmitAppContext {
  remoteApp: SecuritySubmitApp
  developerPlatformClient: DeveloperPlatformClient
}

export interface SecuritySubmitDependencies {
  findRoot(directory: string): string
  artifactPaths(appRoot: string): AppSecurityArtifactPaths
  readDeterministicFindings(path: string): Promise<ReadArtifactResult<DeterministicFindingsDocument>>
  resolveClientId(options: {directory: string; clientId?: string; configName?: string}): Promise<string>
  fetchApp(clientId: string): Promise<SecuritySubmitAppContext>
  buildSubmission(
    deterministicFindings: DeterministicFindingsDocument,
    options: BuildSubmissionOptions,
  ): AppSecuritySubmission
  writeSubmission(appRoot: string, bytes: Buffer): Promise<void>
  canPrompt(): boolean
  readStdin(): Promise<string | undefined>
  promptForFeedback(): Promise<string>
  confirm(input: SecuritySubmitConfirmationInput): Promise<SecuritySubmitConfirmationAction>
  submitScan(options: SubmitAppSecurityScanOptions): Promise<SubmitAppSecurityScanResult>
  now(): string
  cliVersion: string
}

const defaultDependencies: SecuritySubmitDependencies = {
  findRoot: resolveAppSecurityRoot,
  artifactPaths: appSecurityArtifactPaths,
  readDeterministicFindings,
  resolveClientId: resolveSecuritySubmitClientId,
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
  promptForFeedback: renderSecuritySubmitFeedbackPrompt,
  confirm: renderSecuritySubmitConfirmation,
  submitScan: submitAppSecurityScan,
  now: () => new Date().toISOString(),
  cliVersion: CLI_KIT_VERSION,
}

async function resolveExplicitFeedback(
  options: SecuritySubmitOptions,
  dependencies: SecuritySubmitDependencies,
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

export default async function securitySubmit(
  options: SecuritySubmitOptions,
  dependencies: SecuritySubmitDependencies = defaultDependencies,
): Promise<SecuritySubmitResult> {
  if (!options.dryRun && !options.force && (options.json || !dependencies.canPrompt())) {
    throw new AbortError('Pass --force to submit without confirmation.')
  }

  const appRoot = dependencies.findRoot(options.directory)
  const paths = dependencies.artifactPaths(appRoot)
  const scanResult = await dependencies.readDeterministicFindings(paths.deterministicFindingsPath)

  if (scanResult.status === 'missing') {
    throw new AbortError(`No App Security scan found in ${paths.artifactDirectory}.`, null, [
      `Run \`shopify app security check --path ${options.directory}\` first, then submit.`,
    ])
  }
  if (scanResult.status === 'invalid') {
    throw new AbortError(`The App Security scan at ${paths.deterministicFindingsPath} is not valid.`, null, [
      scanResult.message,
    ])
  }
  const deterministicFindings = scanResult.value
  if (containsUnredactedSecret(deterministicFindings)) {
    throw new AbortError(
      `The App Security scan at ${paths.deterministicFindingsPath} contains an unredacted secret.`,
      null,
      [`Run \`shopify app security check --path ${options.directory}\` to regenerate it, then submit.`],
    )
  }

  const submittedAt = dependencies.now()
  const prepareFeedback = (feedback: string | undefined) =>
    prepareSubmissionPayload(
      dependencies.buildSubmission(deterministicFindings, {
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
