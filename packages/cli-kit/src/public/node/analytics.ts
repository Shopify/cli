import {alwaysLogAnalytics, alwaysLogMetrics, analyticsDisabled, isShopify} from './context/local.js'
import * as metadata from './metadata.js'
import {publishMonorailEvent, MONORAIL_COMMAND_TOPIC} from './monorail.js'
import {fanoutHooks} from './plugins.js'
import {sendErrorToBugsnag} from './error-handler.js'
import {outputContent, outputDebug, outputToken} from './output.js'
import {
  recordTiming as storageRecordTiming,
  recordError as storageRecordError,
  recordRetry as storageRecordRetry,
  recordEvent as storageRecordEvent,
  compileData as storageCompileData,
  RuntimeData,
} from '../../private/node/analytics/storage.js'
import {getEnvironmentData, getSensitiveEnvironmentData} from '../../private/node/analytics.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {recordMetrics} from '../../private/node/otel-metrics.js'
import {runWithRateLimit} from '../../private/node/conf-store.js'
import {reportingRateLimit} from '../../private/node/constants.js'
import {getLastSeenUserIdAfterAuth} from '../../private/node/session.js'
import {requestIdsCollection} from '../../private/node/request-ids.js'

import {Interfaces} from '@oclif/core'

export type CommandExitMode =
  // The command completed successfully
  | 'ok'
  // The command exited for some unexpected reason -- i.e. a bug
  | 'unexpected_error'
  // The command exited with an error, but its one we expect and doesn't point to a bug -- i.e. malformed config files
  | 'expected_error'

interface ReportAnalyticsEventOptions {
  config: Interfaces.Config
  errorMessage?: string
  exitMode: CommandExitMode
}

export async function sendAnalyticsEventFromFile(payloadFile: string): Promise<void> {
  const {readFile, removeFile} = await import('./fs.js')
  try {
    const payloadStr = await readFile(payloadFile)
    const payload = JSON.parse(payloadStr)

    // remove file
    await removeFile(payloadFile)

    const doMonorail = async () => {
      if (payload.skipMonorailAnalytics) return
      const response = await publishMonorailEvent(MONORAIL_COMMAND_TOPIC, payload.public, payload.sensitive)
      if (response.type === 'error') {
        outputDebug(response.message)
      }
    }

    const doOpenTelemetry = async () => {
      if (payload.skipMetricAnalytics) return

      const active = payload.public.cmd_all_timing_active_ms ?? 0
      const network = payload.public.cmd_all_timing_network_ms ?? 0
      const prompt = payload.public.cmd_all_timing_prompts_ms ?? 0

      return recordMetrics(
        {
          skipMetricAnalytics: payload.skipMetricAnalytics,
          cliVersion: payload.public.cli_version,
          owningPlugin: payload.public.cmd_all_plugin ?? '@shopify/cli',
          command: payload.public.command,
          exitMode: payload.public.cmd_all_exit,
        },
        {
          active,
          network,
          prompt,
        },
      )
    }

    await Promise.all([doMonorail(), doOpenTelemetry()])
  } catch (error) {
    if (error instanceof Error) {
      outputDebug(`Failed to send analytics in background: ${error.message}`)
    } else {
      throw error
    }
  }
}

/**
 * Report an analytics event, sending it off to Monorail -- Shopify's internal analytics service.
 *
 * The payload for an event includes both generic data, and data gathered from installed plug-ins.
 *
 */
export async function reportAnalyticsEvent(options: ReportAnalyticsEventOptions): Promise<void> {
  try {
    const payload = await buildPayload(options)
    if (payload === undefined || payload.public.command === 'send-analytics') {
      return
    }

    let withinRateLimit = false
    await runWithRateLimit({
      key: 'report-analytics-event',
      ...reportingRateLimit,
      task: async () => {
        withinRateLimit = true
      },
    })
    if (!withinRateLimit) {
      outputDebug(outputContent`Skipping command analytics due to rate limiting, payload: ${outputToken.json(payload)}`)
      return
    }

    const skipMonorailAnalytics = !alwaysLogAnalytics() && analyticsDisabled()
    const skipMetricAnalytics = !alwaysLogMetrics() && analyticsDisabled()
    if (skipMonorailAnalytics && skipMetricAnalytics) {
      outputDebug(outputContent`Skipping command analytics, payload: ${outputToken.json(payload)}`)
      return
    }

    outputDebug(outputContent`Sending command analytics in background, payload: ${outputToken.json(payload)}`)

    const {joinPath} = await import('./path.js')
    const {tmpdir} = await import('node:os')
    const {writeFile} = await import('./fs.js')

    const payloadPath = joinPath(tmpdir(), `shopify-cli-analytics-${Date.now()}.json`)

    const fullPayload = {
      ...payload,
      skipMonorailAnalytics,
      skipMetricAnalytics,
    }

    await writeFile(payloadPath, JSON.stringify(fullPayload))

    const {exec} = await import('./system.js')
    const argv = process.argv
    if (!argv[0] || !argv[1]) return
    const nodeBinary = argv[0]
    const shopifyBinary = argv[1]
    const args = [shopifyBinary, 'send-analytics', '--payload-file', payloadPath]

    // eslint-disable-next-line no-void
    void exec(nodeBinary, args, {
      background: true,
      env: {...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1'},
      externalErrorHandler: async (error: unknown) => {
        outputDebug(`Failed to send analytics in background: ${(error as Error).message}`)
      },
    })

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
    await sendErrorToBugsnag(error, 'expected_error')
  }
}

async function buildPayload({config, errorMessage, exitMode}: ReportAnalyticsEventOptions) {
  const {commandStartOptions, environmentFlags, ...sensitiveMetadata} = metadata.getAllSensitiveMetadata()
  if (commandStartOptions === undefined) {
    outputDebug('Unable to log analytics event - no information on executed command')
    return
  }
  const {startCommand, startArgs, startTime, endTime} = commandStartOptions
  const currentTime = endTime ?? new Date().getTime()

  // All bundled plugins appear as `@shopify/cli` in the payload
  const {'@shopify/cli': internalPluginsPublic, ...externalPluginsPublic} = await fanoutHooks(
    config,
    'public_command_metadata',
    {},
  )
  const {'@shopify/cli': internalPluginsSensitive, ...externalPluginsSensitive} = await fanoutHooks(
    config,
    'sensitive_command_metadata',
    {},
  )

  const environmentData = await getEnvironmentData(config)
  const sensitiveEnvironmentData = await getSensitiveEnvironmentData(config)
  const publicMetadata = metadata.getAllPublicMetadata()

  // Automatically calculate the total time spent in the command, excluding time spent in subtimers.
  const subTimers = ['cmd_all_timing_network_ms', 'cmd_all_timing_prompts_ms'] as const
  const totalTimeFromSubtimers = subTimers.reduce((total, timer) => {
    const value = publicMetadata[timer]
    if (value !== undefined) {
      return total + value
    }
    return total
  }, 0)
  const wallClockElapsed = currentTime - startTime
  const totalTimeWithoutSubtimers = wallClockElapsed - totalTimeFromSubtimers

  const payload = {
    public: {
      command: startCommand,
      time_start: startTime,
      time_end: currentTime,
      total_time: wallClockElapsed,
      success: exitMode === 'ok' && errorMessage === undefined,
      cli_version: CLI_KIT_VERSION,
      ruby_version: '',
      node_version: process.version.replace('v', ''),
      is_employee: await isShopify(),
      ...environmentData,
      ...internalPluginsPublic,
      ...publicMetadata,
      cmd_all_timing_active_ms: totalTimeWithoutSubtimers,
      cmd_all_exit: exitMode,
      user_id: await getLastSeenUserIdAfterAuth(),
      request_ids: requestIdsCollection.getRequestIds(),
    },
    sensitive: {
      args: startArgs.join(' '),
      cmd_all_environment_flags: environmentFlags,
      error_message: errorMessage,
      ...internalPluginsSensitive,
      ...sensitiveEnvironmentData,
      metadata: JSON.stringify({
        ...sensitiveMetadata,
        extraPublic: {
          ...externalPluginsPublic,
        },
        extraSensitive: {...externalPluginsSensitive},
      }),
    },
  }

  // round down timing metrics
  const timingMetrics = ['cmd_all_timing_active_ms', 'cmd_all_timing_network_ms', 'cmd_all_timing_prompts_ms'] as const
  timingMetrics.forEach((metric) => {
    const current = payload.public[metric]
    if (current !== undefined) {
      payload.public[metric] = Math.floor(current)
    }
  })

  return sanitizePayload(payload)
}

function sanitizePayload<T>(payload: T): T {
  const payloadString = JSON.stringify(payload)
  // Remove Theme Access passwords from the payload
  const sanitizedPayloadString = payloadString.replace(/shptka_\w*/g, '*****')
  return JSON.parse(sanitizedPayloadString)
}

/**
 * Records timing data for performance monitoring. Call twice with the same
 * event name to start and stop timing. First call starts the timer, second
 * call stops it and records the duration.
 *
 * @example
 * ```ts
 *   recordTiming('theme-upload') // Start timing
 *   // ... do work ...
 *   recordTiming('theme-upload') // Stop timing and record duration
 * ```
 *
 * @param eventName - Unique identifier for the timing event
 */
export function recordTiming(eventName: string): void {
  storageRecordTiming(eventName)
}

/**
 * Records error information for debugging and monitoring. Use this to track
 * any exceptions or error conditions that occur during theme operations.
 * Errors are automatically categorized for easier analysis.
 *
 * @example
 * ```ts
 *   try {
 *     // ... risky operation ...
 *   } catch (error) {
 *     recordError(error)
 *   }
 * ```
 *
 * @param error - Error object or message to record
 */
export function recordError<T>(error: T): T {
  storageRecordError(error)
  return error
}

/**
 * Records retry attempts for network operations. Use this to track when
 * operations are retried due to transient failures. Helps identify
 * problematic endpoints or operations that frequently fail.
 *
 * @example
 * ```ts
 *   recordRetry('https://api.shopify.com/themes', 'upload')
 * ```
 *
 * @param url - The URL or endpoint being retried
 * @param operation - Description of the operation being retried
 */
export function recordRetry(url: string, operation: string): void {
  storageRecordRetry(url, operation)
}

/**
 * Records custom events for tracking specific user actions or system events.
 * Use this for important milestones, user interactions, or significant
 * state changes in the application.
 *
 * @example
 * ```ts
 *   recordEvent('theme-dev-started')
 *   recordEvent('file-watcher-connected')
 * ```
 *
 * @param eventName - Descriptive name for the event
 */
export function recordEvent(eventName: string): void {
  storageRecordEvent(eventName)
}

/**
 * Compiles and returns all runtime analytics data collected during the session.
 * This includes timing measurements, error records, retry attempts, and custom
 * events. Use this to retrieve a complete snapshot of analytics data for
 * reporting or debugging purposes.
 *
 * @example
 * ```ts
 *   const analyticsData = compileData()
 *   console.log(`Recorded ${analyticsData.timings.length} timing events`)
 *   console.log(`Recorded ${analyticsData.errors.length} errors`)
 * ```
 *
 * @returns Object containing all collected analytics data including timings, errors, retries, and events
 */
export function compileData(): RuntimeData {
  return storageCompileData()
}
