import {CommandExitMode, reportAnalyticsEvent} from './analytics.js'
import * as path from './path.js'
import {fanoutHooks} from './plugins.js'
import * as metadata from './metadata.js'
import {
  AbortSilentError,
  CancelExecution,
  errorMapper,
  shouldReportErrorAsUnexpected,
  handler,
  cleanSingleStackTracePath,
} from './error.js'
import {isLocalEnvironment} from '../../private/node/context/service.js'
import {getEnvironmentData} from '../../private/node/analytics.js'
import {outputDebug, outputInfo} from '../../public/node/output.js'
import {bugsnagApiKey, reportingRateLimit} from '../../private/node/constants.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {runWithRateLimit} from '../../private/node/conf-store.js'
import {settings, Interfaces} from '@oclif/core'
import StackTracey from 'stacktracey'
import Bugsnag, {Event} from '@bugsnag/js'
import {realpath} from 'fs/promises'

// Allowed slice names for error analytics grouping.
// Hardcoded list per product slices to keep analytics consistent.
const ALLOWED_SLICE_NAMES = new Set<string>(['app', 'theme', 'hydrogen', 'store'])

export async function errorHandler(
  error: Error & {exitCode?: number | undefined},
  config?: Interfaces.Config,
): Promise<void> {
  if (error instanceof CancelExecution) {
    if (error.message && error.message !== '') {
      outputInfo(`✨  ${error.message}`)
    }
  } else if (error instanceof AbortSilentError) {
    /* empty */
  } else {
    return errorMapper(error)
      .then((error) => {
        return handler(error)
      })
      .then((mappedError) => {
        return reportError(mappedError, config)
      })
  }
}

const reportError = async (error: unknown, config?: Interfaces.Config): Promise<void> => {
  // categorise the error first
  let exitMode: CommandExitMode = 'expected_error'
  if (shouldReportErrorAsUnexpected(error)) exitMode = 'unexpected_error'

  if (config !== undefined) {
    // Log an analytics event when there's an error
    await reportAnalyticsEvent({config, errorMessage: error instanceof Error ? error.message : undefined, exitMode})
  }
  await sendErrorToBugsnag(error, exitMode)
}

/**
 * Sends an error to Bugsnag. This is configured automatically for uncaught errors from CLI commands, but can also be used to manually record an error.
 *
 * @returns the reported error (this may have been tweaked for better reporting), and a bool to indicate if the error was actually submitted or not
 */
export async function sendErrorToBugsnag(
  error: unknown,
  exitMode: Omit<CommandExitMode, 'ok'>,
): Promise<{reported: false; error: unknown; unhandled: unknown} | {error: Error; reported: true; unhandled: boolean}> {
  try {
    if (isLocalEnvironment() || settings.debug) {
      outputDebug(`Skipping Bugsnag report`)
      return {reported: false, error, unhandled: undefined}
    }

    // If the error was unexpected, we flag it as "unhandled" in Bugsnag. This is a helpful distinction.
    const unhandled = exitMode === 'unexpected_error'

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

    let withinRateLimit = false
    await runWithRateLimit({
      key: 'send-error-to-bugsnag',
      ...reportingRateLimit,
      task: async () => {
        withinRateLimit = true
      },
    })
    if (!withinRateLimit) {
      outputDebug(`Skipping Bugsnag report due to rate limiting`)
      report = false
    }

    if (report) {
      initializeBugsnag()
      await new Promise((resolve, reject) => {
        outputDebug(`Reporting ${unhandled ? 'unhandled' : 'handled'} error to Bugsnag: ${reportableError.message}`)
        const eventHandler = (event: Event) => {
          event.severity = 'error'
          event.unhandled = unhandled
          // Attach command metadata so we know which CLI command triggered the error
          const {commandStartOptions} = metadata.getAllSensitiveMetadata()
          const {startCommand} = commandStartOptions ?? {}
          if (startCommand) {
            const firstWord = startCommand.trim().split(/\s+/)[0] ?? 'cli'
            const sliceName = ALLOWED_SLICE_NAMES.has(firstWord) ? firstWord : 'cli'
            event.addMetadata('custom', {slice_name: sliceName})
          }
        }
        const errorHandler = (error: unknown) => {
          if (error) {
            reject(error)
          } else {
            resolve(reportableError)
          }
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Bugsnag.notify(reportableError, eventHandler, errorHandler)
      })
    }
    return {error: reportableError, reported: report, unhandled}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    outputDebug(`Error reporting to Bugsnag: ${err}`)
    return {error, reported: false, unhandled: undefined}
  }
}

/**
 * If the given file path is within a node_modules folder, remove prefix up
 * to and including the node_modules folder.
 *
 * This gives us very consistent paths for errors generated by the CLI.
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
  const fullLocation = path.isAbsolutePath(currentFilePath)
    ? currentFilePath
    : path.joinPath(projectRoot, currentFilePath)

  const matchingPluginPath = pluginLocations.filter(({pluginPath}) => fullLocation.startsWith(pluginPath))[0]

  if (matchingPluginPath !== undefined) {
    // the plugin name (e.g. @shopify/cli-kit), plus the relative path of the error line from within the plugin's code (e.g. dist/something.js )
    return path.joinPath(matchingPluginPath.name, path.relativePath(matchingPluginPath.pluginPath, fullLocation))
  }

  // strip prefix up to node_modules folder, so we can normalize error reporting
  return currentFilePath.replace(/.*node_modules\//, '')
}

/**
 * Register a Bugsnag error listener to clean up stack traces for errors within plugin code.
 *
 */
export async function registerCleanBugsnagErrorsFromWithinPlugins(config: Interfaces.Config): Promise<void> {
  // Bugsnag have their own plug-ins that use this private field

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bugsnagConfigProjectRoot: string = (Bugsnag as any)?._client?._config?.projectRoot ?? path.cwd()
  const projectRoot = path.normalizePath(bugsnagConfigProjectRoot)
  const pluginLocations = await Promise.all(
    [...config.plugins].map(async ([_, plugin]) => {
      const followSymlinks = await realpath(plugin.root)
      return {name: plugin.name, pluginPath: path.normalizePath(followSymlinks)}
    }),
  )
  initializeBugsnag()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  Bugsnag.addOnError(async (event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.errors.forEach((error: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error.stacktrace.forEach((stackFrame: any) => {
        stackFrame.file = cleanStackFrameFilePath({currentFilePath: stackFrame.file, projectRoot, pluginLocations})
      })
    })
    try {
      await addBugsnagMetadata(event, config)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (metadataError) {
      outputDebug(`There was an error adding metadata to the Bugsnag report; Ignoring and carrying on ${metadataError}`)
    }
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export async function addBugsnagMetadata(event: any, config: Interfaces.Config): Promise<void> {
  const publicData = metadata.getAllPublicMetadata()
  const {commandStartOptions} = metadata.getAllSensitiveMetadata()
  const {startCommand} = commandStartOptions ?? {}

  const {'@shopify/app': appPublic, ...otherPluginsPublic} = await fanoutHooks(config, 'public_command_metadata', {})

  const environment = await getEnvironmentData(config)

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
  const appKeys = ['api_key', 'business_platform_id', 'partner_id', 'project_type']
  const commandKeys = ['command']
  const environmentKeys = ['cli_version', 'node_version', 'uname']

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

function initializeBugsnag() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (Bugsnag.isStarted()) {
    return
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  Bugsnag.start({
    appType: 'node',
    apiKey: bugsnagApiKey,
    logger: null,
    appVersion: CLI_KIT_VERSION,
    autoTrackSessions: false,
    autoDetectErrors: false,
    enabledReleaseStages: ['production'],
    endpoints: {
      notify: 'https://error-analytics-production.shopifysvc.com',
      sessions: 'https://error-analytics-sessions-production.shopifysvc.com',
    },
    // Set the project root to `null` to prevent the default behavior of
    // Bugsnag which is to set it to the cwd. That is unhelpful for us because
    // the cwd can be anywhere in the user's filesystem, not necessarily
    // related to the CLI codebase.
    projectRoot: null,
  })
}
