import {
  AbortSilent,
  CancelExecution,
  mapper as errorMapper,
  shouldReport as shouldReportError,
  handler,
} from '../error.js'
import {info} from '../output.js'
import {reportEvent} from '../analytics.js'
import * as path from '../path.js'
import {settings, Interfaces} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag from '@bugsnag/js'
import {realpath} from 'fs/promises'

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
      const filePath = path.normalize(item.file).replace('file:/', '/').replace('C:/', '')
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
 * If the given file path comes from within a plugin, return the relative path, plus the plugin name.
 *
 * This gives us very consistent paths for errors thrown from plugin code.
 *
 */
export function cleanStackFrameFilePath({
  currentFilePath,
  projectRoot,
  pluginLocations,
}: {
  currentFilePath: string
  projectRoot: string
  pluginLocations: {name: string; pluginPath: string}[]
}): string {
  const fullLocation = path.isAbsolute(currentFilePath) ? currentFilePath : path.join(projectRoot, currentFilePath)

  const matchingPluginPath = pluginLocations.filter(({pluginPath}) => fullLocation.indexOf(pluginPath) === 0)[0]

  if (matchingPluginPath !== undefined) {
    return path.join(matchingPluginPath.name, path.relative(matchingPluginPath.pluginPath, fullLocation))
  }
  return currentFilePath
}

/**
 * Register a Bugsnag error listener to clean up stack traces for errors within plugin code.
 *
 */
export async function registerCleanBugsnagErrorsFromWithinPlugins(plugins: Interfaces.Plugin[]) {
  // Bugsnag have their own plug-ins that use this private field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bugsnagConfigProjectRoot: string = (Bugsnag as any)?._client?._config?.projectRoot ?? process.cwd()
  const projectRoot = path.normalize(bugsnagConfigProjectRoot)
  const pluginLocations = await Promise.all(
    plugins.map(async (plugin) => {
      const followSymlinks = await realpath(plugin.root)
      return {name: plugin.name, pluginPath: path.normalize(followSymlinks)}
    }),
  )
  Bugsnag.addOnError((event) => {
    event.errors.forEach((error) => {
      error.stacktrace.forEach((stackFrame) => {
        stackFrame.file = cleanStackFrameFilePath({currentFilePath: stackFrame.file, projectRoot, pluginLocations})
      })
    })
  })
}
