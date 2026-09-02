import {linkedAppContext} from './app-context.js'
import {appDoctorArtifactPaths, readTrace, writeSubmission} from './app-doctor-artifacts.js'
import {findAppRoot} from './app-doctor-engine/scanners/discover.js'
import {buildSubmission, SUBMISSION_SCHEMA_VERSION} from './app-doctor-engine/submission/index.js'
import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {
  renderDoctorSubmitConfirmation,
  renderDoctorSubmitDryRun,
  renderDoctorSubmitSuccess,
} from './doctor-submit-output.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import type {AppDoctorArtifactPaths, ReadTraceResult} from './app-doctor-artifacts.js'
import type {AppDoctorSubmission, BuildSubmissionOptions} from './app-doctor-engine/submission/index.js'
import type {TraceV2} from './app-doctor-engine/types.js'
import type {SubmitAppDoctorScanOptions} from './app-doctor-submit-api.js'
import type {
  DoctorSubmitConfirmationInput,
  DoctorSubmitDryRunInput,
  DoctorSubmitSuccessInput,
} from './doctor-submit-output.js'
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
  sourceControlUrl?: string
}

interface DoctorSubmitApp extends MinimalAppIdentifiers {
  title: string
}

interface DoctorSubmitAppContext {
  remoteApp: DoctorSubmitApp
  developerPlatformClient: DeveloperPlatformClient
}

export interface DoctorSubmitJsonResult {
  operation: 'submit'
  dry_run: boolean
  app: {title: string}
  payload: {path: string; schema_version: typeof SUBMISSION_SCHEMA_VERSION}
  scan?: {id: string}
  submitted_at?: string
}

export interface DoctorSubmitDependencies {
  findRoot(directory: string): string
  artifactPaths(appRoot: string): AppDoctorArtifactPaths
  readTrace(path: string): Promise<ReadTraceResult>
  linkApp(options: {
    directory: string
    clientId: string | undefined
    forceRelink: boolean
    userProvidedConfigName: string | undefined
    skipPrompts: boolean
  }): Promise<DoctorSubmitAppContext>
  buildSubmission(trace: TraceV2, options: BuildSubmissionOptions): AppDoctorSubmission
  writeSubmission(path: string, payload: AppDoctorSubmission): Promise<void>
  canPrompt(): boolean
  confirm(input: DoctorSubmitConfirmationInput): Promise<boolean>
  submitScan(options: SubmitAppDoctorScanOptions): Promise<{id: string} | null>
  renderDryRun(input: DoctorSubmitDryRunInput): void
  renderSuccess(input: DoctorSubmitSuccessInput): void
  output(content: string): void
  now(): string
  cliVersion: string
}

const defaultDependencies: DoctorSubmitDependencies = {
  findRoot: findAppRoot,
  artifactPaths: appDoctorArtifactPaths,
  readTrace,
  linkApp: linkedAppContext,
  buildSubmission,
  writeSubmission,
  canPrompt: terminalSupportsPrompting,
  confirm: renderDoctorSubmitConfirmation,
  submitScan: submitAppDoctorScan,
  renderDryRun: renderDoctorSubmitDryRun,
  renderSuccess: renderDoctorSubmitSuccess,
  output: outputResult,
  now: () => new Date().toISOString(),
  cliVersion: CLI_KIT_VERSION,
}

interface JsonResultInput {
  appTitle: string
  submissionPath: string
  submission: AppDoctorSubmission
  dryRun: boolean
  scan?: {id: string} | null
}

function jsonResult({
  appTitle,
  submissionPath,
  submission,
  dryRun,
  scan = null,
}: JsonResultInput): DoctorSubmitJsonResult {
  return {
    operation: 'submit',
    dry_run: dryRun,
    app: {title: appTitle},
    payload: {path: submissionPath, schema_version: SUBMISSION_SCHEMA_VERSION},
    ...(scan === null ? {} : {scan}),
    ...(dryRun ? {} : {submitted_at: submission.submitted_at}),
  }
}

export default async function doctorSubmit(
  options: DoctorSubmitOptions,
  dependencies: DoctorSubmitDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.findRoot(options.directory)
  const paths = dependencies.artifactPaths(appRoot)
  const traceResult = await dependencies.readTrace(paths.trace)

  if (traceResult.status === 'missing') {
    throw new AbortError(`No App Doctor trace found in ${paths.directory}.`, null, [
      `Run \`shopify app doctor --path ${options.directory}\` first, then submit.`,
    ])
  }
  if (traceResult.status === 'invalid') {
    throw new AbortError(`The App Doctor trace at ${paths.trace} is not valid.`, null, traceResult.errors)
  }

  const {remoteApp, developerPlatformClient} = await dependencies.linkApp({
    directory: appRoot,
    clientId: options.clientId,
    forceRelink: false,
    userProvidedConfigName: options.configName,
    skipPrompts: options.json,
  })
  const submission = dependencies.buildSubmission(traceResult.trace, {
    cliVersion: dependencies.cliVersion,
    submittedAt: dependencies.now(),
    versionTag: options.versionTag,
    sourceControlUrl: options.sourceControlUrl,
  })
  await dependencies.writeSubmission(paths.submission, submission)

  if (options.dryRun) {
    if (options.json) {
      dependencies.output(
        JSON.stringify(
          jsonResult({
            appTitle: remoteApp.title,
            submissionPath: paths.submission,
            submission,
            dryRun: true,
          }),
          null,
          2,
        ),
      )
    } else {
      dependencies.renderDryRun({submissionPath: paths.submission})
    }
    return
  }

  if (!options.force) {
    if (options.json || !dependencies.canPrompt()) {
      throw new AbortError('Pass --force to submit without confirmation.')
    }
    const confirmed = await dependencies.confirm({
      appTitle: remoteApp.title,
      submissionPath: paths.submission,
      submission,
    })
    if (!confirmed) return
  }

  const scan = await dependencies.submitScan({
    app: remoteApp,
    submission,
    submissionPath: paths.submission,
    developerPlatformClient,
  })

  if (options.json) {
    dependencies.output(
      JSON.stringify(
        jsonResult({
          appTitle: remoteApp.title,
          submissionPath: paths.submission,
          submission,
          dryRun: false,
          scan,
        }),
        null,
        2,
      ),
    )
  } else {
    dependencies.renderSuccess({
      appTitle: remoteApp.title,
      scanId: scan?.id,
      submissionPath: paths.submission,
    })
  }
}
