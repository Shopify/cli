// CLI
import {run, flush, settings} from '@oclif/core'
import Bugsnag from '@bugsnag/js'
import {error as kitError, output, store, constants, analytics, environment} from '@shopify/cli-kit'

async function runCLI() {
  await store.initializeCliKitStore()
  output.initiateLogging({filename: 'shopify.cli.log'})
  if (environment.local.isDebug()) {
    settings.debug = true
  } else {
    Bugsnag.start({
      apiKey: '9e1e6889176fd0c795d5c659225e0fae',
      logger: null,
      appVersion: await constants.versions.cliKit(),
      autoTrackSessions: false,
    })
  }

  run(undefined, import.meta.url)
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      if (error instanceof kitError.AbortSilent) {
        process.exit(1)
      }
      const kitMapper = kitError.mapper
      const kitHandle = kitError.handler
      // eslint-disable-next-line promise/no-nesting
      return kitMapper(error)
        .then(reportError)
        .then((error: Error) => {
          return kitHandle(error)
        })
        .then(() => {
          process.exit(1)
        })
    })
}

const reportError = async (errorToReport: Error): Promise<Error> => {
  await analytics.reportEvent({errorMessage: errorToReport.message})
  if (settings.debug || !kitError.shouldReport(errorToReport)) return errorToReport

  let mappedError: Error

  // eslint-disable-next-line no-prototype-builtins
  if (Error.prototype.isPrototypeOf(errorToReport)) {
    mappedError = new Error(errorToReport.message)
    if (errorToReport.stack) {
      // For mac/linux, remove `file:///` from stacktrace
      // For windows, remove `file:///C:/` from stacktrace
      mappedError.stack = errorToReport.stack.replace(new RegExp('file:///([a-zA-Z]:/)?', 'g'), '/')
    }
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

export default runCLI
