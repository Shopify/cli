import {
  AbortSilent,
  CancelExecution,
  mapper as errorMapper,
  shouldReport as shouldReportError,
  handler as errorHandler,
} from '../error.js'
import {info} from '../output.js'
import {reportEvent} from '../analytics.js'
import {normalize} from '../path.js'
import {settings} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag from '@bugsnag/js'

export function globalCommandErrorHandler(error: Error & {exitCode?: number | undefined}) {
  if (error instanceof CancelExecution) {
    if (error.message && error.message !== '') {
      info(`✨  ${error.message}`)
    }
  } else if (error instanceof AbortSilent) {
    process.exit(1)
  } else {
    return errorMapper(error)
      .then((error: Error) => {
        return errorHandler(error)
      })
      .then(reportError)
      .then(() => {
        process.exit(1)
      })
  }
}

const reportError = async (errorToReport: Error): Promise<Error> => {
  await reportEvent({errorMessage: errorToReport.message})
  if (settings.debug || !shouldReportError(errorToReport)) return errorToReport

  let mappedError: Error

  // eslint-disable-next-line no-prototype-builtins
  if (Error.prototype.isPrototypeOf(errorToReport)) {
    mappedError = new Error(errorToReport.message)
    const mappedStacktrace = new StackTracey(errorToReport)
      .clean()
      .items.map((item) => {
        const filePath = normalize(item.file).replace('file:/', '/').replace('C:/', '')
        return `    at ${item.callee} (${filePath}:${item.line}:${item.column})`
      })
      .join('\n')
    mappedError.stack = `Error: ${errorToReport.message}\n${mappedStacktrace}`
  } else if (typeof errorToReport === 'string') {
    mappedError = new Error(errorToReport)
  } else {
    mappedError = new Error('Unknown error')
  }

  await new Promise((resolve, reject) => {
    Bugsnag.notify(mappedError, undefined, resolve)
  })
  return mappedError
}
