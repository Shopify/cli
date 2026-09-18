import {quoteShellArgument, shellForPlatform} from './app-doctor-commands.js'
import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {
  AppDoctorScopeError,
  ENGINE_NAME,
  buildAppDoctorInstructions,
  buildAppDoctorReviewScopes,
  getEngineVersion,
  loadChecks,
} from './app-doctor-engine/index.js'
import {
  appDoctorInstructionsJsonOutputSchema,
  type AppDoctorInstructionsResult,
} from './app-doctor-instructions-json.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import clipboard from 'clipboardy'
import type {AppDoctorContext, Check} from './app-doctor-engine/index.js'

export type AppDoctorInstructionsFormat = 'json' | 'text'

export interface AppDoctorInstructionsOptions {
  readonly directory?: string
  readonly configName?: string
  readonly clientId?: string
  /** Directories to review; omitted means the whole app. Relative entries resolve against the invocation directory. */
  readonly reviewDirectories?: string[]
  /** Decided by the caller (typically `isTerminalInteractive()`); prompts are only shown when true. */
  readonly interactive: boolean
  readonly format: AppDoctorInstructionsFormat
  readonly copy?: boolean
  readonly writePath?: string
}

export type AppDoctorInstructionsOutputOptions = Pick<AppDoctorInstructionsOptions, 'format' | 'copy' | 'writePath'>

export interface AppDoctorInstructionsGenerateDependencies {
  resolveContext(options: ResolveAppDoctorContextOptions): Promise<AppDoctorContext>
  invocationDirectory(): string
  /** Shell-quotes one argument for the shell the instructions will be pasted into. */
  quote(value: string): string
  /** The check catalogue frozen into the review tokens; injected so tests can record against a small one. */
  loadChecks(): ReadonlyMap<string, Check>
}

export interface AppDoctorInstructionsWriteDependencies {
  copyToClipboard(content: string): Promise<void>
  writeToFile(path: string, content: string): Promise<void>
  output(content: string): void
  outputConfirmation(content: string): void
}

export function shellQuote(
  value: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return quoteShellArgument(value, shellForPlatform(platform, env))
}

const defaultGenerateDependencies: AppDoctorInstructionsGenerateDependencies = {
  resolveContext: resolveAppDoctorContext,
  invocationDirectory: cwd,
  quote: (value) => shellQuote(value),
  loadChecks,
}

const defaultWriteDependencies: AppDoctorInstructionsWriteDependencies = {
  copyToClipboard: (content) => clipboard.write(content),
  writeToFile: writeFile,
  output: outputResult,
  outputConfirmation: (content) => {
    renderSuccess({headline: content})
  },
}

/**
 * Build the standalone agent instructions as typed data. Nothing is printed:
 * the context is resolved once, review scopes are derived from it, and every
 * embedded check prompt is frozen into a per-scope review token.
 */
export async function generateAppDoctorInstructions(
  options: AppDoctorInstructionsOptions,
  dependencies: AppDoctorInstructionsGenerateDependencies = defaultGenerateDependencies,
): Promise<AppDoctorInstructionsResult> {
  const context = await dependencies.resolveContext({
    directory: options.directory,
    configName: options.configName,
    clientId: options.clientId,
    interactive: options.interactive,
  })
  let scopes
  try {
    scopes = await buildAppDoctorReviewScopes(context, {
      reviewDirectories: options.reviewDirectories,
      invocationDirectory: dependencies.invocationDirectory(),
    })
  } catch (error) {
    if (error instanceof AppDoctorScopeError) {
      throw new AbortError(error.message, 'Pass --review with directories inside the app you want reviewed.')
    }
    throw error
  }
  const instructions = buildAppDoctorInstructions({
    context,
    scopes,
    checks: [...dependencies.loadChecks().values()],
    quote: dependencies.quote,
    engine: {name: ENGINE_NAME, version: getEngineVersion()},
  })
  return {
    schema_version: 1,
    configuration: {
      identity: context.configurationIdentity,
      path: context.configurationPath,
      name: context.configurationFileName,
      ...(context.clientId === undefined ? {} : {client_id: context.clientId}),
    },
    app_root: context.appRoot,
    scopes: instructions.scopes.map((scope) => ({
      ...scope,
      // The engine exposes args as ReadonlyArray; the zod-inferred JSON type wants a mutable string[].
      record_command: {...scope.record_command, args: [...scope.record_command.args]},
    })),
    checks: [...instructions.checks],
    instructions: instructions.markdown,
  }
}

/** Presenter: JSON goes to stdout exactly once; text is printed, copied, or written with a confirmation banner. */
export async function writeAppDoctorInstructionsResult(
  result: AppDoctorInstructionsResult,
  options: AppDoctorInstructionsOutputOptions,
  dependencies: AppDoctorInstructionsWriteDependencies = defaultWriteDependencies,
): Promise<void> {
  if (options.format === 'json') {
    dependencies.output(appDoctorInstructionsJsonOutputSchema.encode(result))
    return
  }
  if (options.copy) {
    await dependencies.copyToClipboard(result.instructions)
    dependencies.outputConfirmation('Copied App Doctor instructions to the clipboard')
  } else if (options.writePath) {
    await dependencies.writeToFile(options.writePath, `${result.instructions}\n`)
    dependencies.outputConfirmation(`Wrote App Doctor instructions to ${options.writePath}`)
  } else {
    dependencies.output(result.instructions)
  }
}

export default async function deliverAppDoctorInstructions(
  options: AppDoctorInstructionsOptions,
  dependencies: AppDoctorInstructionsGenerateDependencies & AppDoctorInstructionsWriteDependencies = {
    ...defaultGenerateDependencies,
    ...defaultWriteDependencies,
  },
): Promise<void> {
  const result = await generateAppDoctorInstructions(options, dependencies)
  await writeAppDoctorInstructionsResult(result, options, dependencies)
}
