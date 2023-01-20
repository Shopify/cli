import {version as rubyVersion} from './ruby.js'
import {alwaysLogAnalytics, analyticsDisabled, isShopify} from './environment/local.js'
import * as metadata from './metadata.js'
import {publishMonorailEvent, MONORAIL_COMMAND_TOPIC} from './monorail.js'
import {content, debug, token} from '../../output.js'
import {fanoutHooks} from '../../plugins.js'
import {getEnvironmentData, getSensitiveEnvironmentData} from '../../private/node/analytics.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {Interfaces} from '@oclif/core'

interface ReportAnalyticsEventOptions {
  config: Interfaces.Config
  errorMessage?: string
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
    if (!alwaysLogAnalytics() && analyticsDisabled()) {
      debug(content`Skipping command analytics, payload: ${token.json(payload)}`)
      return
    }
    const response = await publishMonorailEvent(MONORAIL_COMMAND_TOPIC, payload.public, payload.sensitive)
    if (response.type === 'error') {
      debug(response.message)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
  }
}

async function buildPayload({config, errorMessage}: ReportAnalyticsEventOptions) {
  const {commandStartOptions, ...sensitiveMetadata} = metadata.getAllSensitiveMetadata()
  if (commandStartOptions === undefined) {
    debug('Unable to log analytics event - no information on executed command')
    return
  }
  const {startCommand, startArgs, startTime} = commandStartOptions
  const currentTime = new Date().getTime()

  const {'@shopify/app': appPublic, ...otherPluginsPublic} = await fanoutHooks(config, 'public_command_metadata', {})
  const {'@shopify/app': appSensitive, ...otherPluginsSensitive} = await fanoutHooks(
    config,
    'sensitive_command_metadata',
    {},
  )

  const environmentData = await getEnvironmentData(config)
  const sensitiveEnvironmentData = await getSensitiveEnvironmentData(config)

  return {
    public: {
      command: startCommand,
      time_start: startTime,
      time_end: currentTime,
      total_time: currentTime - startTime,
      success: errorMessage === undefined,
      cli_version: CLI_KIT_VERSION,
      ruby_version: (await rubyVersion()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await isShopify(),
      ...environmentData,
      ...appPublic,
      ...metadata.getAllPublicMetadata(),
    },
    sensitive: {
      args: startArgs.join(' '),
      error_message: errorMessage,
      ...appSensitive,
      ...sensitiveEnvironmentData,
      metadata: JSON.stringify({
        ...sensitiveMetadata,
        extraPublic: {
          ...otherPluginsPublic,
        },
        extraSensitive: {...otherPluginsSensitive},
      }),
    },
  }
}
