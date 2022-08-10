import {Message, stringifyMessage, error as outputError} from './output.js'
import {normalize} from './path.js'
import {Errors} from '@oclif/core'
import ExtendableError from 'ts-error'

export {ExtendableError} from 'ts-error'
export {AbortSignal} from 'abort-controller'

enum FatalErrorType {
  Abort,
  AbortSilent,
  Bug,
}

export class CancelExecution extends Error {}

/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export abstract class Fatal extends Error {
  tryMessage: string | null
  type: FatalErrorType
  constructor(message: Message, type: FatalErrorType, tryMessage: Message | null = null) {
    super(stringifyMessage(message))
    this.tryMessage = tryMessage ? stringifyMessage(tryMessage) : null
    this.type = type
  }
}

/**
 * An abort error is a fatal error that shouldn't be reported as a bug.
 * Those usually represent unexpected scenarios that we can't handle and that usually require some action from the developer
 */
export class Abort extends Fatal {
  constructor(message: Message, tryMessage: Message | null = null) {
    super(message, FatalErrorType.Abort, tryMessage)
  }
}

export class AbortSilent extends Fatal {
  constructor() {
    super('', FatalErrorType.AbortSilent)
  }
}

/**
 * A bug error is an error that represents a bug and therefore should be reported.
 */
export class Bug extends Fatal {
  constructor(message: Message, tryMessage: string | null = null) {
    super(message, FatalErrorType.Bug, tryMessage)
  }
}

/**
 * A function that handles errors that blow up in the CLI.
 * @param error Error to be handled.
 * @returns A promise that resolves with the error passed.
 */
export async function handler(error: Error): Promise<Error> {
  let fatal: Fatal
  if (isFatal(error)) {
    fatal = error as Fatal
  } else if (typeof error === 'string') {
    fatal = new Bug(error as string)
  } else {
    fatal = new Bug(error.message)
    fatal.stack = error.stack
  }

  if (fatal.type === FatalErrorType.Bug) {
    fatal.stack = error.stack
  }

  await outputError(fatal)
  return Promise.resolve(error)
}

export function mapper(error: Error): Promise<Error> {
  if (error instanceof Errors.CLIError) {
    const mappedError = new Abort(error.message)
    mappedError.stack = error.stack
    return Promise.resolve(mappedError)
  } else {
    return Promise.resolve(error)
  }
}

export function isFatal(error: Error): boolean {
  return Object.prototype.hasOwnProperty.call(error, 'type')
}

export function shouldReport(error: Error): boolean {
  if (!isFatal(error)) {
    return true
  }
  if ((error as Fatal).type === FatalErrorType.Bug) {
    return true
  }
  return false
}

/**
 * Stack traces usually have file:// - we strip that and also remove the Windows drive designation
 *
 */
export function cleanSingleStackTracePath(filePath: string): string {
  return normalize(filePath)
    .replace('file:/', '/')
    .replace(/^\/?[A-Z]:/, '')
}

export type ManagedError = ExtendableError & ({type: 'ApiError'; status: number} | {type: 'Other'; context?: string})

const populateBaseError = (error: Error): ExtendableError => ({
  stack: error.stack,
  name: error.name,
  message: error.message,
})

export const apiError = (error: Error, status: number): ManagedError => ({
  type: 'ApiError',
  status,
  ...populateBaseError(error),
})
