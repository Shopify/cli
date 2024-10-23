import {AlertCustomSection, renderFatalError} from './ui.js'
import {OutputMessage, stringifyMessage, TokenizedString} from '../../public/node/output.js'
import {normalizePath} from '../../public/node/path.js'
import {InlineToken, TokenItem, tokenItemToString} from '../../private/node/ui/components/TokenizedText.js'
import {Errors} from '@oclif/core'

export {ExtendableError} from 'ts-error'

export enum FatalErrorType {
  Abort,
  AbortSilent,
  Bug,
}

export class CancelExecution extends Error {}

/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export abstract class FatalError extends Error {
  tryMessage: TokenItem | null
  type: FatalErrorType
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

  renderFatalError(fatal)
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
      const message = error.message
      return !errorMessageImpliesEnvironmentIssue(message, error.stack ?? '')
    }
    return true
  }
  if (error.type === FatalErrorType.Bug) {
    return true
  }
  return false
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
 * @param stack - The stack trace to check.
 * @returns A boolean indicating if the error message implies an environment issue.
 */
function errorMessageImpliesEnvironmentIssue(message: string, stack: string): boolean {
  const environmentIssueMessages = [
    'EPERM: operation not permitted, scandir',
    'EACCES: permission denied',
    'EPERM: operation not permitted, symlink',
    'This version of npm supports the following node versions',
    'EBUSY: resource busy or locked',
    'getaddrinfo ENOTFOUND',
    'Client network socket disconnected before secure TLS connection was established',
    'spawn EPERM',
    'socket hang up',
    'ENOSPC: no space left on device',
    ['Maximum call stack size exceeded', /stubborn-fs.*retryify/],
  ] as const
  const anyMatches = environmentIssueMessages.some((issueMessage) => {
    if (typeof issueMessage === 'string') {
      return message.includes(issueMessage)
    }
    const [messageCheck, stackCheck] = issueMessage
    return message.includes(messageCheck) && stackCheck.test(stack)
  })
  return anyMatches
}
