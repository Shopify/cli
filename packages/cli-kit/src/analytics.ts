/* eslint-disable @typescript-eslint/naming-convention */
import * as environment from './environment.js'
import {platformAndArch} from './os.js'
import {exists as fileExists} from './file.js'
import {join as joinPath, resolve} from './path.js'
import {version as rubyVersion} from './node/ruby.js'
import {debug} from './output.js'
import constants from './constants.js'
import {cliKitStore} from './store.js'
import * as metadata from './metadata.js'
import {publishEvent} from './monorail.js'
import {fanoutHooks} from './plugins.js'
import {Interfaces} from '@oclif/core'

interface StartOptions {
  command: string
  args: string[]
  currentTime?: number
}

export const start = ({command, args, currentTime = new Date().getTime()}: StartOptions) => {
  metadata.addSensitive({
    commandStartOptions: {
      startTime: currentTime,
      startCommand: command,
      startArgs: args,
    },
  })
}

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
export async function reportEvent(options: ReportEventOptions) {
  if (environment.local.analyticsDisabled()) return

  try {
    const payload = await buildPayload(options)
    if (payload === undefined) {
      // Nothing to log
      return
    }
    const response = await publishEvent('app_cli3_command/1.0', payload.public, payload.sensitive)
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

const buildPayload = async ({config, errorMessage}: ReportEventOptions) => {
  const {commandStartOptions, ...sensitiveMetadata} = metadata.getAllSensitive()
  if (commandStartOptions === undefined) {
    debug('Unable to log analytics event - no information on executed command')
    return
  }
  const {startCommand, startArgs, startTime} = commandStartOptions
  const currentTime = new Date().getTime()

  let directory = process.cwd()
  const pathFlagIndex = startArgs.indexOf('--path')
  if (pathFlagIndex >= 0) {
    directory = resolve(startArgs[pathFlagIndex + 1])
  }
  const appInfo = cliKitStore().getAppInfo(directory)

  const {platform, arch} = platformAndArch()

  const rawPartnerId = appInfo?.orgId
  let partnerIdAsInt: number | undefined
  if (rawPartnerId !== undefined) {
    partnerIdAsInt = parseInt(rawPartnerId, 10)
    if (isNaN(partnerIdAsInt)) {
      partnerIdAsInt = undefined
    }
  }

  const publicPluginData = await fanoutHooks(config, 'public_command_metadata', {})
  const sensitivePluginData = await fanoutHooks(config, 'sensitive_command_metadata', {})

  const appSpecific = {
    project_type: await getProjectType(joinPath(directory, 'web')),
    api_key: appInfo?.appId,
    partner_id: partnerIdAsInt,
  }

  return {
    public: {
      command: startCommand,
      time_start: startTime,
      time_end: currentTime,
      total_time: currentTime - startTime,
      success: errorMessage === undefined,
      uname: `${platform} ${arch}`,
      cli_version: await constants.versions.cliKit(),
      ruby_version: (await rubyVersion()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await environment.local.isShopify(),
      ...appSpecific,
    },
    sensitive: {
      args: startArgs.join(' '),
      error_message: errorMessage,
      metadata: JSON.stringify({
        ...sensitiveMetadata,
        extraPublic: publicPluginData,
        extraSensitive: sensitivePluginData,
      }),
    },
  }
}

export type ProjectType = 'node' | 'php' | 'ruby' | undefined

export async function getProjectType(directory: string): Promise<ProjectType> {
  const nodeConfigFile = joinPath(directory, 'package.json')
  const rubyConfigFile = joinPath(directory, 'Gemfile')
  const phpConfigFile = joinPath(directory, 'composer.json')

  if (await fileExists(nodeConfigFile)) {
    return 'node'
  } else if (await fileExists(rubyConfigFile)) {
    return 'ruby'
  } else if (await fileExists(phpConfigFile)) {
    return 'php'
  }
  return undefined
}
