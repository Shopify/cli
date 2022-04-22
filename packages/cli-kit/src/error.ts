import * as ouput from './output'
import {Errors} from '@oclif/core'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sourceMapSupport from 'source-map-support'

sourceMapSupport.install()

/**
 * A fatal error represents an error shouldn't be rescued and that causes the execution to terminate.
 * There shouldn't be code that catches fatal errors.
 */
export class Fatal extends Error {
  tryMessage: string | null
  constructor(message: string, tryMessage: string | null = null) {
    super(message)
    this.tryMessage = tryMessage
  }
}

/**
 * An abort error is a fatal error that shouldn't be reported as a bug.
 * Those usually represent unexpected scenarios that we can't handle and that usually require some action from the developer
 */
export class Abort extends Fatal {}

export class AbortSilent extends Fatal {
  constructor() {
    super('')
  }
}

/**
 * A bug error is an error that represents a bug and therefore should be reported.
 */
export class Bug extends Fatal {}

/**
 * A function that handles errors that blow up in the CLI.
 * @param error Error to be handled.
 * @returns A promise that resolves with the error passed.
 */
export async function handler(error: Error): Promise<Error> {
  const fatal = error instanceof Fatal ? error : new Fatal(error.message)
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
