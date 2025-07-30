import {alwaysLogAnalytics, alwaysLogMetrics, analyticsDisabled, isShopify} from './context/local.js'
import * as metadata from './metadata.js'
import {publishMonorailEvent, MONORAIL_COMMAND_TOPIC} from './monorail.js'
import {fanoutHooks} from './plugins.js'
import {
  recordTiming as storeRecordTiming,
  recordError as storeRecordError,
  recordRetry as storeRecordRetry,
  recordEvent as storeRecordEvent,
} from './analytics/storage.js'
import {outputContent, outputDebug, outputToken} from '../../public/node/output.js'
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

/**
 * Report an analytics event, sending it off to Monorail -- Shopify's internal analytics service.
 *
 * The payload for an event includes both generic data, and data gathered from installed plug-ins.
 *
 */
export async function reportAnalyticsEvent(options: ReportAnalyticsEventOptions): Promise<void> {
  try {
    const payload = await buildPayload(options)
    if (payload === undefined) {
      // Nothing to log
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
    if (skipMonorailAnalytics || skipMetricAnalytics) {
      outputDebug(outputContent`Skipping command analytics, payload: ${outputToken.json(payload)}`)
    }

    const doMonorail = async () => {
      if (skipMonorailAnalytics) {
        return
      }
      const response = await publishMonorailEvent(MONORAIL_COMMAND_TOPIC, payload.public, payload.sensitive)
      if (response.type === 'error') {
        outputDebug(response.message)
      }
    }
    const doOpenTelemetry = async () => {
      const active = payload.public.cmd_all_timing_active_ms || 0
      const network = payload.public.cmd_all_timing_network_ms || 0
      const prompt = payload.public.cmd_all_timing_prompts_ms || 0

      return recordMetrics(
        {
          skipMetricAnalytics,
          cliVersion: payload.public.cli_version,
          owningPlugin: payload.public.cmd_all_plugin || '@shopify/cli',
          command: payload.public.command,
          exitMode: options.exitMode,
        },
        {
          active,
          network,
          prompt,
        },
      )
    }
    await Promise.all([doMonorail(), doOpenTelemetry()])

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
  }
}

async function buildPayload({config, errorMessage, exitMode}: ReportAnalyticsEventOptions) {
  const {commandStartOptions, environmentFlags, ...sensitiveMetadata} = metadata.getAllSensitiveMetadata()
  if (commandStartOptions === undefined) {
    outputDebug('Unable to log analytics event - no information on executed command')
    return
  }
  const {startCommand, startArgs, startTime} = commandStartOptions
  const currentTime = new Date().getTime()

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

  let payload = {
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

  // strip undefined fields -- they make up the majority of payloads due to wide metadata structure.
  payload = JSON.parse(JSON.stringify(payload))

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
  storeRecordTiming(eventName)
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
  storeRecordError(error)
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
  storeRecordRetry(url, operation)
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
  storeRecordEvent(eventName)
}
