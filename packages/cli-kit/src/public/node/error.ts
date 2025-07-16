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
 * Stack traces usually have file:// - we strip that and also remove the Windows drive designation.
 *
 * @param filePath - Path to be cleaned.
 * @returns The cleaned path.
 */
export function cleanSingleStackTracePath(filePath: string): string {
  let cleanedPath = normalizePath(filePath)

  // Handle file:// protocol
  if (cleanedPath.startsWith('file:///')) {
    cleanedPath = cleanedPath.replace('file:///', '')
  } else if (cleanedPath.startsWith('file:/')) {
    cleanedPath = cleanedPath.replace('file:/', '/')
  }

  // CRITICAL: Add security guards
  if (cleanedPath.length > 1000) {
    cleanedPath = `${cleanedPath.substring(0, 1000)}...`
  }

  // CRITICAL: Sanitize path traversal
  cleanedPath = cleanedPath.replace(/\.\.\//g, '')
  cleanedPath = cleanedPath.replace(/\.\//g, '')

  // CRITICAL: Preserve drive letters (before slash conversion)
  cleanedPath = cleanedPath.replace(/^([A-Z]):/, '<DRIVE_$1>')
  cleanedPath = cleanedPath.replace(/^\/([A-Z]):/, '<DRIVE_$1>')

  // Convert all backslashes to forward slashes for consistency
  cleanedPath = cleanedPath.replace(/\\/g, '/')

  // Add missing normalizations
  cleanedPath = cleanedPath.replace(/^node:/, '<NODE>:')
  cleanedPath = cleanedPath.replace(/^webpack:\/\/\//, '<WEBPACK>/')

  // CI/CD environment paths - process these BEFORE home directory normalization
  cleanedPath = cleanedPath.replace(/^\/home\/runner\/work\/[^/]+\/[^/]+\//, '<CI_WORKSPACE>/')
  cleanedPath = cleanedPath.replace(/^\/github\/workspace\//, '<CI_WORKSPACE>/')
  cleanedPath = cleanedPath.replace(/^\/opt\/build\/repo\//, '<CI_WORKSPACE>/')
  cleanedPath = cleanedPath.replace(/^\/builds\/[^/]+\/[^/]+\//, '<CI_WORKSPACE>/')
  cleanedPath = cleanedPath.replace(/^\/bitbucket\/pipelines\/agent\/build\//, '<CI_WORKSPACE>/')
  cleanedPath = cleanedPath.replace(/^\/codebuild\/output\/[^/]+\//, '<CI_WORKSPACE>/')

  // Normalize user home directories to <HOME>
  // Windows: C:/Users/username or /Users/username on WSL
  cleanedPath = cleanedPath.replace(/^\/Users\/[^/]+/, '<HOME>')
  cleanedPath = cleanedPath.replace(/^\/home\/[^/]+/, '<HOME>')
  cleanedPath = cleanedPath.replace(/^\/root/, '<HOME>')

  // Windows specific home paths
  cleanedPath = cleanedPath.replace(/^\/Documents and Settings\/[^/]+/, '<HOME>')
  cleanedPath = cleanedPath.replace(/^\/Users\/[^/]+\/AppData\/Roaming/, '<HOME>/AppData/Roaming')
  cleanedPath = cleanedPath.replace(/^\/Users\/[^/]+\/AppData\/Local/, '<HOME>/AppData/Local')

  // Normalize global npm/yarn paths BEFORE temp directories
  // npm global paths
  cleanedPath = cleanedPath.replace(/^<HOME>\/AppData\/Roaming\/npm\/node_modules\//, '<GLOBAL_NPM>/')
  cleanedPath = cleanedPath.replace(/^\/usr\/local\/lib\/node_modules\//, '<GLOBAL_NPM>/')
  cleanedPath = cleanedPath.replace(/^\/usr\/lib\/node_modules\//, '<GLOBAL_NPM>/')
  cleanedPath = cleanedPath.replace(/^<HOME>\/\.npm-global\/lib\/node_modules\//, '<GLOBAL_NPM>/')

  // yarn global paths
  cleanedPath = cleanedPath.replace(/^<HOME>\/\.yarn\/berry\/cache\//, '<YARN_CACHE>/')
  cleanedPath = cleanedPath.replace(/^<HOME>\/\.config\/yarn\/global\/node_modules\//, '<GLOBAL_YARN>/')

  // pnpm global paths
  cleanedPath = cleanedPath.replace(/^<HOME>\/\.pnpm-store\//, '<PNPM_STORE>/')
  cleanedPath = cleanedPath.replace(/^<HOME>\/\.local\/share\/pnpm\/global\/[^/]+\/node_modules\//, '<GLOBAL_PNPM>/')

  // Normalize temp directories to <TEMP> - AFTER global paths
  cleanedPath = cleanedPath.replace(/^\/tmp\//, '<TEMP>/')
  cleanedPath = cleanedPath.replace(/^\/var\/folders\/[^/]+\/[^/]+\/[^/]+\//, '<TEMP>/')
  cleanedPath = cleanedPath.replace(/^\/Users\/[^/]+\/AppData\/Local\/Temp\//, '<TEMP>/')
  cleanedPath = cleanedPath.replace(/^<HOME>\/AppData\/Local\/Temp\//, '<TEMP>/')

  // Normalize webpack chunk hashes
  cleanedPath = cleanedPath.replace(/chunk-[A-Z0-9]{8}\.js/, 'chunk-<HASH>.js')
  cleanedPath = cleanedPath.replace(/chunk\.[a-f0-9]{8,}\.js/, 'chunk.<HASH>.js')

  // Normalize other common hash patterns in filenames
  cleanedPath = cleanedPath.replace(/\.[a-f0-9]{8}\.(js|mjs|cjs|ts)$/, '.<HASH>.$1')
  cleanedPath = cleanedPath.replace(/\.[a-f0-9]{16,}\.(js|mjs|cjs|ts)$/, '.<HASH>.$1')

  // Normalize container and cloud environments
  cleanedPath = cleanedPath.replace(/^\/app\//, '<CONTAINER>/')
  cleanedPath = cleanedPath.replace(/^\/workspace\//, '<CONTAINER>/')
  cleanedPath = cleanedPath.replace(/^\/usr\/src\/app\//, '<CONTAINER>/')

  // CRITICAL: Fix version pattern - remove slash requirement and fix potential ReDoS
  cleanedPath = cleanedPath.replace(
    /@[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9\-._]+)?(?:\+[a-zA-Z0-9\-._]+)?/g,
    '@<VERSION>',
  )

  // CRITICAL: Fix UUID pattern - remove slash requirements
  cleanedPath = cleanedPath.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<UUID>')

  return cleanedPath
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
  ]
  const anyMatches = environmentIssueMessages.some((issueMessage) => message.includes(issueMessage))
  return anyMatches
}
