import {
  AbortSilent,
  CancelExecution,
  mapper as errorMapper,
  shouldReport as shouldReportError,
  handler,
} from '../error.js'
import {info} from '../output.js'
import {reportEvent} from '../analytics.js'
import {normalize} from '../path.js'
import {settings} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag from '@bugsnag/js'

export function errorHandler(error: Error & {exitCode?: number | undefined}) {
  if (error instanceof CancelExecution) {
    if (error.message && error.message !== '') {
      info(`✨  ${error.message}`)
    }
  } else if (error instanceof AbortSilent) {
    process.exit(1)
  } else {
    return errorMapper(error)
      .then((error: Error) => {
        return handler(error)
      })
      .then(reportError)
      .then(() => {
        process.exit(1)
      })
  }
}

const reportError = async (error: Error): Promise<Error> => {
  await reportEvent({errorMessage: error.message})
  if (settings.debug || !shouldReportError(error)) return error

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
