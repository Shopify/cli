import {
  AbortSilent,
  CancelExecution,
  mapper as errorMapper,
  shouldReport as shouldReportError,
  handler,
  cleanSingleStackTracePath,
} from '../error.js'
import {debug, info} from '../output.js'
import {getEnvironmentData, reportEvent} from '../analytics.js'
import * as path from '../path.js'
import * as metadata from '../metadata.js'
import {fanoutHooks} from '../plugins.js'
import constants, {bugsnagApiKey} from '../constants.js'
import {settings, Interfaces} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag, {Event} from '@bugsnag/js'
import {realpath} from 'fs/promises'

export function errorHandler(error: Error & {exitCode?: number | undefined}, config?: Interfaces.Config) {
  if (error instanceof CancelExecution) {
    if (error.message && error.message !== '') {
      info(`✨  ${error.message}`)
    }
  } else if (error instanceof AbortSilent) {
    process.exit(1)
  } else {
    return errorMapper(error)
      .then((error) => {
        return handler(error)
      })
      .then((mappedError) => reportError(mappedError, config))
      .then(() => {
        process.exit(1)
      })
  }
}

const reportError = async (error: unknown, config?: Interfaces.Config): Promise<void> => {
  if (config !== undefined) {
    // Log an analytics event when there's an error
    await reportEvent({config, errorMessage: error instanceof Error ? error.message : undefined})
  }
  await sendErrorToBugsnag(error)
}

/**
 * Sends an error to Bugsnag. This is configured automatically for uncaught errors from CLI commands, but can also be used to manually record an error.
 *
 * @returns the reported error (this may have been tweaked for better reporting), and a bool to indicate if the error was actually submitted or not
 */
export async function sendErrorToBugsnag(
  error: unknown,
): Promise<{reported: false; error: unknown} | {error: Error; reported: true}> {
  if (settings.debug || !shouldReportError(error)) return {reported: false, error}

  let reportableError: Error
  let stacktrace: string | undefined
  let report = false

  if (error instanceof Error) {
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
  } else if (typeof error === 'string' && error.trim().length !== 0) {
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
      const filePath = cleanSingleStackTracePath(item.file)
      return `    at ${item.callee} (${filePath}:${item.line}:${item.column})`
    })
    .join('\n')
  reportableError.stack = `Error: ${reportableError.message}\n${formattedStacktrace}`

  if (report) {
    await initializeBugsnag()
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
  return {error: reportableError, reported: report}
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
    // the plugin name (e.g. @shopify/cli-kit), plus the relative path of the error line from within the plugin's code (e.g. dist/something.js )
    return path.join(matchingPluginPath.name, path.relative(matchingPluginPath.pluginPath, fullLocation))
  }
  return currentFilePath
}

/**
 * Register a Bugsnag error listener to clean up stack traces for errors within plugin code.
 *
 */
export async function registerCleanBugsnagErrorsFromWithinPlugins(config: Interfaces.Config) {
  // Bugsnag have their own plug-ins that use this private field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bugsnagConfigProjectRoot: string = (Bugsnag as any)?._client?._config?.projectRoot ?? process.cwd()
  const projectRoot = path.normalize(bugsnagConfigProjectRoot)
  const pluginLocations = await Promise.all(
    config.plugins.map(async (plugin) => {
      const followSymlinks = await realpath(plugin.root)
      return {name: plugin.name, pluginPath: path.normalize(followSymlinks)}
    }),
  )
  await initializeBugsnag()
  Bugsnag.addOnError(async (event) => {
    event.errors.forEach((error) => {
      error.stacktrace.forEach((stackFrame) => {
        stackFrame.file = cleanStackFrameFilePath({currentFilePath: stackFrame.file, projectRoot, pluginLocations})
      })
    })
    try {
      await addBugsnagMetadata(event, config)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (metadataError) {
      debug(`There was an error adding metadata to the Bugsnag report; Ignoring and carrying on ${metadataError}`)
    }
  })
}

export async function addBugsnagMetadata(event: Event, config: Interfaces.Config) {
  const publicData = metadata.getAllPublic()
  const {commandStartOptions} = metadata.getAllSensitive()
  const {startCommand} = commandStartOptions ?? {}

  const {'@shopify/app': appPublic, ...otherPluginsPublic} = await fanoutHooks(config, 'public_command_metadata', {})

  const environment = getEnvironmentData(config)

  const allMetadata = {
    command: startCommand,
    ...appPublic,
    ...publicData,
    ...environment,
    pluginData: otherPluginsPublic,
  }

  const appData = {} as {[key: string]: unknown}
  const commandData = {} as {[key: string]: unknown}
  const environmentData = {} as {[key: string]: unknown}
  const miscData = {} as {[key: string]: unknown}
  const appKeys = ['api_key', 'partner_id', 'project_type']
  const commandKeys = ['command']
  const environmentKeys = ['cli_version', 'node_version', 'ruby_version', 'uname']

  Object.entries(allMetadata).forEach(([key, value]) => {
    if (key.startsWith('app_') || appKeys.includes(key)) {
      appData[key] = value
    } else if (key.startsWith('cmd_') || commandKeys.includes(key)) {
      commandData[key] = value
    } else if (key.startsWith('env_') || environmentKeys) {
      environmentData[key] = value
    } else {
      miscData[key] = value
    }
  })

  // app, command, environment, misc
  const bugsnagMetadata = {
    'Shopify App': appData,
    Command: commandData,
    Environment: environmentData,
    Misc: miscData,
  }
  Object.entries(bugsnagMetadata).forEach(([section, values]) => {
    event.addMetadata(section, values)
  })
}

async function initializeBugsnag() {
  if (Bugsnag.isStarted()) {
    return
  }
  Bugsnag.start({
    appType: 'node',
    apiKey: bugsnagApiKey,
    logger: null,
    appVersion: await constants.versions.cliKit(),
    autoTrackSessions: false,
    autoDetectErrors: false,
  })
}
