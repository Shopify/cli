import {Message, stringifyMessage} from './output.js'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sourceMapSupport from 'source-map-support'

export {ExtendableError} from 'ts-error'
export {AbortSignal} from 'abort-controller'

sourceMapSupport.install()

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
