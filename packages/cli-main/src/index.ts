// CLI
import {version as cliVersion} from '../package.json'
import {run, settings, flush} from '@oclif/core'
import Bugsnag from '@bugsnag/js'
import {error as kitError, environment, output} from '@shopify/cli-kit'

function runCLI() {
  output.initiateLogging({filename: 'shopify.cli.log'})
  if (environment.local.isDebug()) {
    settings.debug = true
  } else {
    Bugsnag.start({
      apiKey: '9e1e6889176fd0c795d5c659225e0fae',
      logger: null,
      appVersion: cliVersion,
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
        .then(bugsnagHandle)
        .then((error: Error) => {
          return kitHandle(error)
        })
        .then(() => {
          process.exit(1)
        })
    })
}

const bugsnagHandle = async (errorToReport: Error): Promise<Error> => {
  // eslint-disable-next-line no-prototype-builtins
  if (!settings.debug && kitError.shouldReport(errorToReport) && Object.prototype.isPrototypeOf(errorToReport)) {
    const reportedError = Object.assign(Object.create(errorToReport), {})
    if (reportedError.stack) reportedError.stack = reportedError.stack.replace(new RegExp('file:///', 'g'), '/')
    await new Promise((resolve, reject) => {
      Bugsnag.notify(reportedError, undefined, resolve)
    })
  }
  return Promise.resolve(errorToReport)
}

export default runCLI
