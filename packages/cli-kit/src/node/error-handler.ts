import {AbortSilent, CancelExecution, Fatal, Bug, Abort, FatalErrorType} from '../error.js'
import {info, error as logError} from '../output.js'
import {reportEvent} from '../analytics.js'
import {normalize} from '../path.js'
import {settings, Errors} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag from '@bugsnag/js'

/**
 * Some transitive packages like @oclif/core might report
 * errors through the process.emitWarning(error) API and ignore or map them
 * to an user-friendly error that lacks the original context that's useful
 * for debugging.
 * This method subscribes to those events and report the errors that are an instance
 * of Errors.CLIError.
 * {@link https://github.com/oclif/core/blob/main/src/config/config.ts#L244}
 */
export async function subscribeToProcessEmittedErrors() {
  process.on('warning', async (error) => {
    if (error instanceof Errors.CLIError) {
      await errorHandler(error)
    }
  })
}

export function errorHandler(error: Error & {exitCode?: number | undefined}) {
  if (error instanceof CancelExecution) {
    if (error.message && error.message !== '') {
      info(`✨  ${error.message}`)
    }
  } else if (error instanceof AbortSilent) {
    process.exit(1)
  } else {
    return mapper(error)
      .then(outputError)
      .then(reportErrorToBugsnag)
      .then(() => {
        process.exit(1)
      })
  }
}

async function reportErrorToBugsnag(error: Error): Promise<Error> {
  await reportEvent({errorMessage: error.message})
  if (settings.debug || !shouldReport(error)) return error

  let reportableError: Error
  let stacktrace: string | undefined
  let report = false

  // eslint-disable-next-line no-prototype-builtins
  if (Error.prototype.isPrototypeOf(error)) {
    report = true
    reportableError = new Error(error.message)
    stacktrace = error.stack

    /**
     * Some errors that reach this point have an empty string. For example:
     * https://app.bugsnag.com/shopify/cli/errors/62cd5d31fd5040000814086c?filters[event.since]=30d&filters[error.status]=new&filters[release.seen_in]=3.1.0
     *
     * Because at this point we have neither the error message nor a stack trace reporting them
     * to Bugsnag is pointless and adds noise.
     */
  } else if (typeof error === 'string' && (error as string).trim().length !== 0) {
    report = true
    reportableError = new Error(error)
    stacktrace = reportableError.stack
  } else {
    report = false
    reportableError = new Error('Unknown error')
  }

  const formattedStacktrace = new StackTracey(stacktrace ?? '')
    .clean()
    .items.map((item) => {
      const filePath = normalize(item.file).replace('file:/', '/').replace('C:/', '')
      return `    at ${item.callee} (${filePath}:${item.line}:${item.column})`
    })
    .join('\n')
  reportableError.stack = `Error: ${reportableError.message}\n${formattedStacktrace}`

  if (report) {
    await new Promise((resolve, reject) => {
      Bugsnag.notify(reportableError, undefined, (error, event) => {
        if (error) {
          reject(error)
        } else {
          resolve(reportableError)
        }
      })
    })
  }
  return reportableError
}

/**
 * A function that handles errors that blow up in the CLI.
 * @param error Error to be handled.
 * @returns A promise that resolves with the error passed.
 */
export async function outputError(error: Error): Promise<Error> {
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

  await logError(fatal)
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
