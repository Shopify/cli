/* eslint-disable @typescript-eslint/naming-convention */
import * as environment from './environment.js'
import {fetch} from './http.js'
import {platformAndArch} from './os.js'
import {exists as fileExists} from './file.js'
import {join as joinPath, resolve} from './path.js'
import {version as rubyVersion} from './node/ruby.js'
import {debug, content, token} from './output.js'
import constants from './constants.js'
import {cliKitStore} from './store.js'

const url = 'https://monorail-edge.shopifysvc.com/v1/produce'
let startTime: number | undefined
let startCommand: string
let startArgs: string[]

interface startOptions {
  command: string
  args: string[]
  currentTime?: number
}

export const start = ({command, args, currentTime = new Date().getTime()}: startOptions) => {
  startCommand = command
  startArgs = args
  startTime = currentTime
}

interface ReportEventOptions {
  errorMessage?: string
}

export const reportEvent = async (options: ReportEventOptions = {}) => {
  if (environment.local.analyticsDisabled()) return
  if (startCommand === undefined) return

  try {
    const currentTime = new Date().getTime()
    const payload = await buildPayload(options.errorMessage, currentTime)
    const body = JSON.stringify(payload)
    const headers = buildHeaders(currentTime)

    const response = await fetch(url, {method: 'POST', body, headers})
    if (response.status === 200) {
      debug(content`Analytics event sent: ${token.json(payload)}`)
    } else {
      debug(`Failed to report usage analytics: ${response.statusText}`)
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

const totalTime = (currentTime: number): number | undefined => {
  if (startTime === undefined) return undefined
  return currentTime - startTime
}

const buildHeaders = (currentTime: number) => {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': currentTime.toString(),
    'X-Monorail-Edge-Event-Sent-At-Ms': currentTime.toString(),
  }
}

const buildPayload = async (errorMessage: string | undefined, currentTime: number) => {
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

  return {
    schema_id: 'app_cli3_command/1.0',
    payload: {
      project_type: await getProjectType(joinPath(directory, 'web')),
      command: startCommand,
      args: startArgs.join(' '),
      time_start: startTime,
      time_end: currentTime,
      total_time: totalTime(currentTime),
      success: errorMessage === undefined,
      error_message: errorMessage,
      uname: `${platform} ${arch}`,
      cli_version: await constants.versions.cliKit(),
      ruby_version: (await rubyVersion()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await environment.local.isShopify(),
      api_key: appInfo?.appId,
      partner_id: partnerIdAsInt,
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
