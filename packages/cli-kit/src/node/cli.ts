// CLI
import {initializeCliKitStore} from '../store.js'
import {initiateLogging} from '../output.js'
import {isDebug} from '../environment/local.js'
import constants, {bugsnagApiKey} from '../constants.js'
import {reportEvent} from '../analytics.js'
import {
  mapper as errorMapper,
  handler as errorHandler,
  AbortSilent,
  shouldReport as shouldReportError,
} from '../error.js'
import {findUpAndReadPackageJson} from '../dependency.js'
import {moduleDirectory} from '../path.js'
import {run, settings, flush} from '@oclif/core'
import Bugsnag from '@bugsnag/js'

interface RunCLIOptions {
  /** The value of import.meta.url of the CLI executable module */
  moduleURL: string
  /** The logs file name */
  logFilename: string
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param module {RunCLIOptions} Options.
 */
export async function runCLI(options: RunCLIOptions) {
  await initializeCliKitStore()
  initiateLogging({filename: options.logFilename})
  if (isDebug()) {
    settings.debug = true
  } else {
    Bugsnag.start({
      apiKey: bugsnagApiKey,
      logger: null,
      appVersion: await constants.versions.cliKit(),
      autoTrackSessions: false,
    })
  }

  run(undefined, options.moduleURL)
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      if (error instanceof AbortSilent) {
        process.exit(1)
      }
      // eslint-disable-next-line promise/no-nesting
      return errorMapper(error)
        .then(reportError)
        .then((error: Error) => {
          return errorHandler(error)
        })
        .then(() => {
          process.exit(1)
        })
    })
}

/**
 * A function for create-x CLIs that automatically runs the "init" command.
 * @param options
 */
export async function runCreateCLI(options: RunCLIOptions) {
  const packageJson = await findUpAndReadPackageJson(moduleDirectory(options.moduleURL))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageName = (packageJson.content as any).name as string
  const name = packageName.replace('@shopify/create-', '')
  const initIndex = process.argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex = process.argv.findIndex((arg) => arg.match(new RegExp(`bin(/|)(create-${name}|dev|run)`))) + 1
    process.argv.splice(initIndex, 0, 'init')
  }
  await runCLI(options)
}

const reportError = async (errorToReport: Error): Promise<Error> => {
  await reportEvent({errorMessage: errorToReport.message})

  if (!settings.debug && shouldReportError(errorToReport)) {
    let mappedError: Error
    // eslint-disable-next-line no-prototype-builtins
    if (Object.prototype.isPrototypeOf(errorToReport)) {
      const mappedError = Object.assign(Object.create(errorToReport), {})
      if (mappedError.stack) mappedError.stack = mappedError.stack.replace(new RegExp('file:///', 'g'), '/')
    } else {
      mappedError = errorToReport
    }
    await new Promise((resolve, reject) => {
      Bugsnag.notify(mappedError, undefined, resolve)
    })
  }
  return Promise.resolve(errorToReport)
}

export default runCLI
