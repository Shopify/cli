import * as ouput from './output'
import {Message, stringifyMessage} from './output'
import {Errors} from '@oclif/core'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sourceMapSupport from 'source-map-support'

export {AbortSignal} from 'abort-controller'

sourceMapSupport.install()

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
  } else {
    fatal = new Bug(error.message)
  }

  if (fatal.type === FatalErrorType.Bug) {
    fatal.stack = error.stack
  }

  await ouput.error(fatal)
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
