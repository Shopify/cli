import {normalizePath} from './path.js'
import {jsonOutputEnabled} from './environment.js'
import {outputDebug, OutputMessage, stringifyMessage, TokenizedString} from './output.js'
import {InlineToken, TokenItem, tokenItemToString} from '../../private/node/ui/components/TokenizedText.js'
import {hasRateLimitCode} from '../../private/node/analytics/graphql-error-codes.js'

import {Errors} from '@oclif/core'
import {ClientError} from 'graphql-request'

import type {AlertCustomSection} from './ui.js'

export {ExtendableError} from 'ts-error'

/**
 * How the program should behave when a `FatalError` reaches the top-level handler.
 *
 * The values are written out explicitly because they are effectively a cross-version wire
 * format: `resolveJsonErrorType` reads this number off errors that may have been built by a
 * different copy of cli-kit (see `bin/bundling/esbuild-plugin-dedup-cli-kit.js`), so a given
 * number has to keep meaning the same thing across versions. This list is append-only: add
 * new members with new values, and never reorder or renumber the existing ones.
 */
export enum FatalErrorType {
  Abort = 0,
  AbortSilent = 1,
  Bug = 2,
}

/**
 * Every `JsonErrorType`, as a runtime value.
 *
 * `JsonErrorType` is derived from this array rather than declared separately so that the
 * compile-time union and the runtime allow-list in `isJsonErrorType` cannot drift apart.
 */
const jsonErrorTypes = ['abort', 'abortSilent', 'bug', 'external'] as const

/**
 * Stable, machine-readable classification of a fatal error, used to derive the `error.type`
 * field of the JSON error document produced when `--json` is active.
 *
 * Not every member reaches the wire: see `EmittedJsonErrorType` for the subset that can
 * actually appear in a document.
 *
 * These are string literals rather than class or enum names on purpose: the published npm
 * bundle is built with `minifyIdentifiers: true` (see `packages/cli/bin/bundle.js`), which
 * rewrites `constructor.name` to a single letter that changes between builds. String
 * literals survive minification.
 *
 * `FatalErrorType` on its own is too coarse to use here, because `AbortError` and
 * `ExternalError` both carry `FatalErrorType.Abort`.
 */
export type JsonErrorType = (typeof jsonErrorTypes)[number]

/**
 * The `JsonErrorType` values that can appear as `error.type` in an emitted document.
 *
 * `abortSilent` is an internal classification only: `AbortSilentError` exists to terminate
 * the process without printing anything, so no document is emitted for it at all. Excluding
 * it here keeps the emitted discriminator a closed union that consumers can switch on
 * exhaustively without handling a value they can never receive.
 */
export type EmittedJsonErrorType = Exclude<JsonErrorType, 'abortSilent'>

/**
 * Whether a value is one of the discriminators this version of cli-kit knows about.
 *
 * @param value - The value to check.
 * @returns Whether the value is a known `JsonErrorType`.
 */
function isJsonErrorType(value: unknown): value is JsonErrorType {
  return typeof value === 'string' && (jsonErrorTypes as ReadonlyArray<string>).includes(value)
}

/**
 * The `JsonErrorType` each `FatalErrorType` maps to by default. Subclasses needing a
 * finer-grained discriminator than the enum can express override `jsonErrorType` in their
 * own constructor.
 *
 * The `satisfies` clause is the exhaustiveness guard: adding a member to `FatalErrorType`
 * without giving it a discriminator here is a compile error.
 */
const jsonErrorTypeForFatalErrorType = {
  [FatalErrorType.Abort]: 'abort',
  [FatalErrorType.AbortSilent]: 'abortSilent',
  [FatalErrorType.Bug]: 'bug',
} as const satisfies Record<FatalErrorType, JsonErrorType>

/**
 * The fields `resolveJsonErrorType` needs, both optional.
 *
 * `isFatal` duck-types on the presence of `type` rather than using `instanceof`, so an error
 * can reach us having been built by a different copy of cli-kit (see
 * `bin/bundling/esbuild-plugin-dedup-cli-kit.js`) that predates `jsonErrorType`, or carrying
 * an enum member this version doesn't know about.
 */
interface JsonErrorTypeSource {
  type?: FatalErrorType
  jsonErrorType?: JsonErrorType
}

/**
 * Resolves the JSON classification for a fatal error.
 *
 * Anything unrecognised is reported as a bug rather than silently mislabelled.
 *
 * @param error - The error to resolve a classification for.
 * @returns The classification for the error.
 */
export function resolveJsonErrorType(error: JsonErrorTypeSource): JsonErrorType {
  // `jsonErrorType` is validated rather than trusted: the type is erased at compile time and
  // the field is publicly writable, so an error built by a newer copy of cli-kit can carry a
  // discriminator this version has never heard of. Passing it through would put an
  // unadvertised value on the wire and break the closed union consumers switch on, so an
  // unknown value is ignored in favour of the numeric fallback.
  if (isJsonErrorType(error.jsonErrorType)) {
    return error.jsonErrorType
  }
  const knownTypes: Record<number, JsonErrorType | undefined> = jsonErrorTypeForFatalErrorType
  return (error.type === undefined ? undefined : knownTypes[error.type]) ?? 'bug'
}

export class CancelExecution extends Error {}

/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export abstract class FatalError extends Error {
  tryMessage: TokenItem | null
  type: FatalErrorType
  jsonErrorType: JsonErrorType
  nextSteps?: TokenItem<InlineToken>[]
  formattedMessage?: TokenItem
  customSections?: AlertCustomSection[]
  skipOclifErrorHandling: boolean
  /**
   * Creates a new FatalError error.
   *
   * @param message - The error message.
   * @param type - The type of fatal error.
   * @param tryMessage - The message that recommends next steps to the user.
   * You can pass a string a {@link TokenizedString} or a {@link TokenItem}
   * if you need to style the message inside the error Banner component.
   * @param nextSteps - Message to show as "next steps" with suggestions to solve the issue.
   * @param customSections - Custom sections to show in the error banner. To be used if nextSteps is not enough.
   */
  constructor(
    message: TokenItem | OutputMessage,
    type: FatalErrorType,
    tryMessage: TokenItem | OutputMessage | null = null,
    nextSteps?: TokenItem<InlineToken>[],
    customSections?: AlertCustomSection[],
  ) {
    const messageIsOutputMessage = typeof message === 'string' || 'value' in message
    super(messageIsOutputMessage ? stringifyMessage(message) : tokenItemToString(message))

    if (tryMessage) {
      if (tryMessage instanceof TokenizedString) {
        this.tryMessage = stringifyMessage(tryMessage)
      } else {
        this.tryMessage = tryMessage
      }
    } else {
      this.tryMessage = null
    }

    this.type = type
    this.jsonErrorType = jsonErrorTypeForFatalErrorType[type]
    this.nextSteps = nextSteps
    this.customSections = customSections
    this.skipOclifErrorHandling = true

    if (!messageIsOutputMessage) {
      this.formattedMessage = message
    }
  }
}

/**
 * An abort error is a fatal error that shouldn't be reported as a bug.
 * Those usually represent unexpected scenarios that we can't handle and that usually require some action from the developer.
 */
export class AbortError extends FatalError {
  nextSteps?: TokenItem<InlineToken>[]
  customSections?: AlertCustomSection[]

  constructor(
    message: TokenItem | OutputMessage,
    tryMessage: TokenItem | OutputMessage | null = null,
    nextSteps?: TokenItem<InlineToken>[],
    customSections?: AlertCustomSection[],
  ) {
    super(message, FatalErrorType.Abort, tryMessage, nextSteps, customSections)
  }
}

/**
 * An external error is similar to Abort but has extra command and args attributes.
 * This is useful to represent errors coming from external commands, usually executed by execa.
 */
export class ExternalError extends FatalError {
  command: string
  args: string[]

  constructor(
    message: OutputMessage,
    command: string,
    args: string[],
    tryMessage: TokenItem | OutputMessage | null = null,
  ) {
    super(message, FatalErrorType.Abort, tryMessage)
    // `FatalErrorType.Abort` is shared with `AbortError`, so override the discriminator to
    // keep the two distinguishable in JSON output.
    this.jsonErrorType = 'external'
    this.command = command
    this.args = args
  }
}

export class AbortSilentError extends FatalError {
  constructor() {
    super('', FatalErrorType.AbortSilent)
  }
}

/**
 * A bug error is an error that represents a bug and therefore should be reported.
 */
export class BugError extends FatalError {
  constructor(message: TokenItem | OutputMessage, tryMessage: TokenItem | OutputMessage | null = null) {
    super(message, FatalErrorType.Bug, tryMessage)
  }
}

/**
 * A function that handles errors that blow up in the CLI.
 *
 * @param error - Error to be handled.
 * @returns A promise that resolves with the error passed.
 */
export async function handler(error: unknown): Promise<unknown> {
  let fatal: FatalError
  if (isFatal(error)) {
    fatal = error
  } else if (typeof error === 'string') {
    fatal = new BugError(error)
  } else if (error instanceof Error) {
    fatal = new BugError(error.message)
    fatal.stack = error.stack
  } else {
    // errors can come in all shapes and sizes...
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeError = error as any
    fatal = new BugError(maybeError?.message ?? 'Unknown error')
    if (maybeError?.stack) {
      fatal.stack = maybeError?.stack
    }
  }

  // This is the single choke point for fatal error rendering, so it's the only place that
  // can guarantee exactly one JSON document per invocation. The other `renderFatalError`
  // call sites are either outside the command lifecycle (the `uncaughtException` handlers)
  // or render and carry on inside long-running dev servers, where emitting a document each
  // time would produce unparseable output.
  let renderedAsJson = false
  if (jsonOutputEnabled()) {
    try {
      const {renderFatalErrorAsJson} = await import('../../private/node/json-error.js')
      renderFatalErrorAsJson(fatal)
      renderedAsJson = true
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (serializationError) {
      // A failure to serialize must not hide the error or stop the caller from reporting it
      // to analytics, so fall through to the human-readable banner instead of rethrowing.
      outputDebug(`Failed to render the error as JSON: ${serializationError}`)
    }
  }

  if (!renderedAsJson) {
    const {renderFatalError} = await import('./ui.js')
    renderFatalError(fatal)
  }
  return Promise.resolve(error)
}

/**
 * A function that maps an error to an Abort with the stack trace when coming from the CLI.
 *
 * @param error - Error to be mapped.
 * @returns A promise that resolves with the new error object.
 */
export function errorMapper(error: unknown): Promise<unknown> {
  if (error instanceof Errors.CLIError) {
    const mappedError = new AbortError(error.message)
    mappedError.stack = error.stack
    return Promise.resolve(mappedError)
  } else {
    return Promise.resolve(error)
  }
}

/**
 * A function that checks if an error is a fatal one.
 *
 * @param error - Error to be checked.
 * @returns A boolean indicating if the error is a fatal one.
 */
function isFatal(error: unknown): error is FatalError {
  try {
    return Object.prototype.hasOwnProperty.call(error, 'type')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * A function that checks if an error should be reported as unexpected.
 *
 * @param error - Error to be checked.
 * @returns A boolean indicating if the error should be reported as unexpected.
 */
export function shouldReportErrorAsUnexpected(error: unknown): boolean {
  if (!isFatal(error)) {
    // this means its not one of the CLI wrapped errors
    if (error instanceof Error) {
      // Raw API errors that slip through unwrapped (e.g. the handleErrors:false path) are expected
      // environmental conditions, not CLI bugs. Treat them as expected so they don't pollute crash
      // reporting.
      if (isExpectedApiError(error)) {
        return false
      }
      const message = error.message
      return !errorMessageImpliesEnvironmentIssue(message)
    }
    return true
  }
  if (error.type === FatalErrorType.Bug) {
    return true
  }
  return false
}

/**
 * Detects raw graphql-request `ClientError`s that are expected environmental conditions rather than
 * CLI bugs. These reach the reporter as plain `Error`s (not `FatalError`s) and would otherwise be
 * reported as unexpected. Two distinct cases, both kept out of crash reporting:
 *
 * HTTP 401 (unauthenticated) is not "transient" in the retry sense — it means the user's session
 * token is expired or invalid, a credential/environment condition (see issue #7891). Rate limiting
 * (HTTP 429, or a `THROTTLED`/`429` GraphQL code on any error in the response) matches the shape
 * detected by `errorsIncludeStatus429` in `private/node/api.ts`.
 *
 * Scoped to the external `ClientError` type only — importing the cli-kit `GraphQLClientError`
 * wrapper here would create an `error.ts → headers.ts → error.ts` import cycle.
 *
 * @param error - Error to be checked.
 * @returns A boolean indicating if the error is a known expected API error.
 */
function isExpectedApiError(error: Error): boolean {
  if (!(error instanceof ClientError)) {
    return false
  }
  const status = error.response?.status
  if (status === 401 || status === 429) {
    return true
  }
  return hasRateLimitCode(error.response?.errors)
}

/**
 * Stack traces usually have file:// - we strip that and also remove the Windows drive designation.
 *
 * @param filePath - Path to be cleaned.
 * @returns The cleaned path.
 */
export function cleanSingleStackTracePath(filePath: string): string {
  return normalizePath(filePath)
    .replace('file:/', '/')
    .replace(/^\/?[A-Z]:/, '')
}

/**
 * There are certain errors that we know are not due to a CLI bug, but are environmental/user error.
 *
 * @param message - The error message to check.
 * @returns A boolean indicating if the error message implies an environment issue.
 */
function errorMessageImpliesEnvironmentIssue(message: string): boolean {
  const environmentIssueMessages = [
    'EPERM: operation not permitted, scandir',
    'EPERM: operation not permitted, rename',
    'EACCES: permission denied',
    'EPERM: operation not permitted, symlink',
    'This version of npm supports the following node versions',
    'EBUSY: resource busy or locked',
    'ENOTEMPTY: directory not empty',
    'getaddrinfo ENOTFOUND',
    'Client network socket disconnected before secure TLS connection was established',
    'spawn EPERM',
    'socket hang up',
    'The user aborted a request.',
    'write EPIPE',
    'Unsupported platform',
  ]
  const anyMatches = environmentIssueMessages.some((issueMessage) => message.includes(issueMessage))
  return anyMatches
}
