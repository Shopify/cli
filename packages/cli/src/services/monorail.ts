/* eslint-disable @typescript-eslint/naming-convention */
import {version} from '../../package.json'
import {environment, os, path, ruby, store} from '@shopify/cli-kit'

export const url = 'https://monorail-edge.shopifysvc.com/v1/produce'

export const buildPayload = async (command: string, args: string[] = []) => {
  const currentTime = new Date().getTime()
  let directory = process.cwd()
  const pathFlagIndex = args.indexOf('--path')
  if (pathFlagIndex >= 0) {
    directory = path.resolve(args[pathFlagIndex + 1])
  }
  const appInfo = store.getAppInfo(directory)
  const {platform, arch} = os.platformAndArch()
  return {
    schema_id: 'app_cli3_command/1.0',
    payload: {
      project_type: 'node',
      command,
      args: args.join(' '),
      time_start: currentTime,
      time_end: currentTime,
      total_time: 0,
      success: true,
      uname: `${platform} ${arch}`,
      cli_version: version,
      ruby_version: (await ruby.version()) || '',
      node_version: process.version.replace('v', ''),
      is_employee: await environment.local.isShopify(),
      api_key: appInfo?.appId,
      partner_id: appInfo?.orgId,
    },
  }
}

export const buildHeaders = () => {
  const currentTime = new Date().getTime()
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': currentTime.toString(),
    'X-Monorail-Edge-Event-Sent-At-Ms': currentTime.toString(),
  }
}
