import {version as rubyVersion} from './ruby.js'
import * as environment from '../../environment.js'
import {content, debug, token} from '../../output.js'
import constants from '../../constants.js'
import * as metadata from '../../metadata.js'
import {publishEvent, MONORAIL_COMMAND_TOPIC} from '../../monorail.js'
import {fanoutHooks, getListOfTunnelPlugins} from '../../plugins.js'
import {getEnvironmentData, getSensitiveEnvironmentData} from '../../private/node/analytics.js'
import {Config, Interfaces} from '@oclif/core'

interface ReportEventOptions {
  config: Interfaces.Config
  errorMessage?: string
}

/**
 * Report an analytics event, sending it off to Monorail -- Shopify's internal analytics service.
 *
 * The payload for an event includes both generic data, and data gathered from installed plug-ins.
 *
 */
export async function reportEvent(options: ReportEventOptions): Promise<void> {
  try {
    const payload = await buildPayload(options)
    if (payload === undefined) {
      // Nothing to log
      return
    }
    if (!environment.local.alwaysLogAnalytics() && environment.local.analyticsDisabled()) {
      debug(content`Skipping command analytics, payload: ${token.json(payload)}`)
      return
    }
    const response = await publishEvent(MONORAIL_COMMAND_TOPIC, payload.public, payload.sensitive)
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

/**
 * Return the name of the tunnel provider used to send analytics. Returns 'localhost' or provider name if any of those
 * strings are included in the {@link tunnelUrl} param. Returns 'custom' otherwise
 *
 * @param options - Oclif configuration. Needed to call the hook for retrieving the list of tunner providers
 * @param tunnelUrl - Tunnel url. Used as pattern to match provider name
 * @returns 'localhost' or provider name if any of those strings are included in
 *  the tunnelUrl or 'custom' otherwise
 */
export async function getAnalyticsTunnelType(options: Config, tunnelUrl: string): Promise<string | undefined> {
  if (!tunnelUrl) {
    return
  }

  if (tunnelUrl.includes('localhost')) {
    return 'localhost'
  }

  const provider = (await getListOfTunnelPlugins(options)).plugins.find((plugin) => tunnelUrl?.includes(plugin))
  return provider ?? 'custom'
}

async function buildPayload({config, errorMessage}: ReportEventOptions) {
  const {commandStartOptions, ...sensitiveMetadata} = metadata.getAllSensitive()
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
      cli_version: await constants.versions.cliKit(),
      ruby_version: (await rubyVersion()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await environment.local.isShopify(),
      ...environmentData,
      ...appPublic,
      ...metadata.getAllPublic(),
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
