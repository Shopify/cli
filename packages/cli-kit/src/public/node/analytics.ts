import {alwaysLogAnalytics, alwaysLogMetrics, analyticsDisabled, isShopify} from './context/local.js'
import * as metadata from './metadata.js'
import {publishMonorailEvent, MONORAIL_COMMAND_TOPIC} from './monorail.js'
import {fanoutHooks} from './plugins.js'

import {outputDebug} from '../../public/node/output.js'
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
      outputDebug(`Skipping command analytics due to rate limiting, payload: ${JSON.stringify(payload, null, 2)}`)
      return
    }

    const skipMonorailAnalytics = !alwaysLogAnalytics() && analyticsDisabled()
    const skipMetricAnalytics = !alwaysLogMetrics() && analyticsDisabled()
    if (skipMonorailAnalytics || skipMetricAnalytics) {
      outputDebug(`Skipping command analytics, payload: ${JSON.stringify(payload, null, 2)}`)
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
