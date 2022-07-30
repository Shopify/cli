/* eslint-disable @typescript-eslint/naming-convention */
import * as environment from './environment.js'
import {platformAndArch} from './os.js'
import {exists as fileExists} from './file.js'
import {join as joinPath, resolve} from './path.js'
import {version as rubyVersion} from './node/ruby.js'
import {debug} from './output.js'
import constants from './constants.js'
import {CachedAppInfo, cliKitStore} from './store.js'
import * as metadata from './metadata.js'
import {publishEvent} from './monorail.js'

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
  errorMessage?: string
}

export const reportEvent = async (options: ReportEventOptions = {}) => {
  const {commandStartOptions, ...restMetadata} = metadata.getAllSensitive()
  if (environment.local.analyticsDisabled()) return
  if (commandStartOptions === undefined) return

  try {
    const currentTime = new Date().getTime()
    const {startArgs} = commandStartOptions
    let directory = process.cwd()
    const pathFlagIndex = startArgs.indexOf('--path')
    if (pathFlagIndex >= 0) {
      directory = resolve(startArgs[pathFlagIndex + 1])
    }
    const appInfo = cliKitStore().getAppInfo(directory)
    const payload = await buildPayload(
      options.errorMessage,
      currentTime,
      commandStartOptions,
      restMetadata,
      appInfo,
      directory,
    )
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

const totalTime = (currentTime: number, startTime: number): number => {
  return currentTime - startTime
}

const buildPayload = async (
  errorMessage: string | undefined,
  currentTime: number,
  commandStartOptions: metadata.Sensitive['commandStartOptions'],
  sensitiveMetadata: Omit<Partial<metadata.Sensitive>, 'commandStartOptions'>,
  appInfo: CachedAppInfo | undefined,
  directory: string,
) => {
  const {startCommand, startArgs, startTime} = commandStartOptions

  const {platform, arch} = platformAndArch()

  const rawPartnerId = appInfo?.orgId
  let partnerIdAsInt: number | undefined
  if (rawPartnerId !== undefined) {
    partnerIdAsInt = parseInt(rawPartnerId, 10)
    if (isNaN(partnerIdAsInt)) {
      partnerIdAsInt = undefined
    }
  }

  return {
    public: {
      project_type: await getProjectType(joinPath(directory, 'web')),
      command: startCommand,
      time_start: startTime,
      time_end: currentTime,
      total_time: totalTime(currentTime, startTime),
      success: errorMessage === undefined,
      uname: `${platform} ${arch}`,
      cli_version: await constants.versions.cliKit(),
      ruby_version: (await rubyVersion()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await environment.local.isShopify(),
      api_key: appInfo?.appId,
      partner_id: partnerIdAsInt,
    },
    sensitive: {
      args: startArgs.join(' '),
      error_message: errorMessage,
      metadata: JSON.stringify(sensitiveMetadata),
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
