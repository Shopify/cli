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
  let cleanedPath = filePath

  // Handle file:// protocol FIRST
  if (cleanedPath.startsWith('file:///')) {
    cleanedPath = cleanedPath.replace('file:///', '')
  } else if (cleanedPath.startsWith('file://')) {
    cleanedPath = cleanedPath.replace('file://', '')
  } else if (cleanedPath.startsWith('file:/')) {
    cleanedPath = cleanedPath.replace('file:/', '/')
  }

  // CRITICAL: Sanitize path traversal BEFORE normalization
  // This prevents normalize from resolving ../ sequences
  cleanedPath = cleanedPath.replace(/\.\.\//g, '')
  cleanedPath = cleanedPath.replace(/\.\//g, '')

  // Now normalize the path (this handles things like double slashes)
  cleanedPath = normalizePath(cleanedPath)

  // CRITICAL: Add security guards
  if (cleanedPath.length > 1000) {
    cleanedPath = `${cleanedPath.substring(0, 1000)}...`
  }

  // Convert all backslashes to forward slashes for consistency
  cleanedPath = cleanedPath.replace(/\\/g, '/')

  // Remove drive letters (after file:// handling and slash conversion)
  cleanedPath = cleanedPath.replace(/^[A-Z]:\//, '')
  cleanedPath = cleanedPath.replace(/^\/[A-Z]:\//, '')

  // Remove leading slashes early so our patterns work consistently
  cleanedPath = cleanedPath.replace(/^\/+/, '')

  // AGGRESSIVE NORMALIZATION: Strip ALL path prefixes
  // For node_modules paths: extract ONLY the part after node_modules/
  const nodeModulesMatch = cleanedPath.match(/^.*node_modules\/(.+)$/)
  if (nodeModulesMatch && nodeModulesMatch[1]) {
    cleanedPath = nodeModulesMatch[1]
  } else {
    // Check for package manager cache paths
    // Yarn cache: .yarn/berry/cache/, .yarn/cache/, etc.
    const yarnCacheMatch = cleanedPath.match(/^.*\.yarn\/(?:berry\/)?cache\/(.+)$/)
    if (yarnCacheMatch && yarnCacheMatch[1]) {
      // Keep the actual file path from the cache, just remove the cache prefix
      cleanedPath = yarnCacheMatch[1]
    } else {
      // pnpm store: .pnpm-store/, .pnpm/, .local/share/pnpm/store/, etc.
      const pnpmStoreMatch = cleanedPath.match(/^.*\.(pnpm-store|pnpm)\/(.+)$/)
      if (pnpmStoreMatch && pnpmStoreMatch[2]) {
        // Keep the actual file path from the store, just remove the store prefix
        cleanedPath = pnpmStoreMatch[2]
      } else {
        // For ALL other paths: strip well-known user-specific path prefixes
        // This ensures identical errors produce identical stack traces regardless of:
        // - User home directory (/home/user, /Users/john, etc.)
        // - CI workspace (/github/workspace, /bitbucket/pipelines, etc.)
        // - Installation location (/usr/local/lib, C:\Program Files, etc.)
        // - Temporary directories (/tmp, /var/folders, etc.)

        // Strip common user-specific prefixes while preserving project structure
        cleanedPath = cleanedPath
          // macOS home: Users/john/...
          .replace(/^Users\/[^/]+\//, '')
          // Linux home: home/jane/...
          .replace(/^home\/[^/]+\//, '')
          // Root home: root/...
          .replace(/^root\//, '')
          // Old Windows
          .replace(/^Documents and Settings\/[^/]+\//, '')
          // Windows program files
          .replace(/^AppData\/Local\/Programs\//, '')
          // Windows roaming data
          .replace(/^AppData\/Roaming\//, '')
          // Windows temp
          .replace(/^AppData\/Local\/Temp\//, '')
          // Windows local data
          .replace(/^AppData\/Local\//, '')
          // macOS temp: var/folders/xx/yyy/zzz/...
          .replace(/^var\/folders\/[^/]+\/[^/]+\/[^/]+\//, '')
          // Unix temp
          .replace(/^tmp\//, '')
          // Unix /opt
          .replace(/^opt\//, '')
          // Unix /usr/local
          .replace(/^usr\/local\//, '')
          // Unix /usr
          .replace(/^usr\//, '')
          // GitHub Actions
          .replace(/^home\/runner\//, '')
          // GitHub workspace
          .replace(/^github\/workspace\//, '')
          // Bitbucket
          .replace(/^bitbucket\/pipelines\/agent\//, '')
          // GitLab CI
          .replace(/^builds\//, '')
          // AWS CodeBuild
          .replace(/^codebuild\/output\/[^/]+\//, '')
          // Docker /app
          .replace(/^app\//, '')
          // Docker /workspace
          .replace(/^workspace\//, '')
      }
    }
  }

  // Normalize webpack chunk hashes
  cleanedPath = cleanedPath.replace(/chunk-[A-Z0-9]{8}\.js/, 'chunk-<HASH>.js')
  cleanedPath = cleanedPath.replace(/chunk\.[a-f0-9]{8,}\.js/, 'chunk.<HASH>.js')

  // Normalize other common hash patterns in filenames
  cleanedPath = cleanedPath.replace(/\.[a-f0-9]{8}\.(js|mjs|cjs|ts)$/, '.<HASH>.$1')
  cleanedPath = cleanedPath.replace(/\.[a-f0-9]{16,}\.(js|mjs|cjs|ts)$/, '.<HASH>.$1')

  // Normalize version patterns
  cleanedPath = cleanedPath.replace(
    /@[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9\-._]+)?(?:\+[a-zA-Z0-9\-._]+)?/g,
    '@<VERSION>',
  )

  // Normalize UUID patterns
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
