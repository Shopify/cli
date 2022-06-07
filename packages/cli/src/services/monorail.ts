/* eslint-disable @typescript-eslint/naming-convention */
import {version as cliVersion} from '../../package.json'
import {environment, os, path, ruby, store} from '@shopify/cli-kit'

export const buildPayload = async (command: string, args: string[] = []) => {
  const currentTime = new Date().getTime()
  const isEmployee = await environment.local.isShopify()
  let directory = process.cwd()
  const pathFlagIndex = args.indexOf('--path')
  if (pathFlagIndex >= 0) {
    directory = path.resolve(args[pathFlagIndex + 1])
  }
  const appInfo = store.getAppInfo(directory)
  const {platform, arch} = os.platformAndArch()
  return {
    projectType: 'node',
    command,
    args: args.join(' '),
    timeStart: currentTime,
    timeEnd: currentTime,
    totalTime: 0,
    success: true,
    uname: `${platform} ${arch}`,
    cliVersion,
    rubyVersion: (await ruby.version()) || '',
    nodeVersion: process.version.replace('v', ''),
    isEmployee,
    api_key: appInfo?.appId,
    partner_id: appInfo?.orgId,
  }
}
