import {hashString} from '../../public/node/crypto.js'
import {getPackageManager, packageManagerUsedForCreating} from '../../public/node/node-package-manager.js'
import BaseCommand from '../../public/node/base-command.js'
import {CommandContent} from '../../public/node/hooks/prerun.js'
import * as metadata from '../../metadata.js'
import {macAddress} from '../../environment/local.js'
import {platformAndArch} from '../../public/node/os.js'
import * as environment from '../../environment.js'
import {Interfaces} from '@oclif/core'

interface StartOptions {
  commandContent: CommandContent
  args: string[]
  currentTime?: number
  commandClass?: Interfaces.Command.Class | typeof BaseCommand
}

export async function startAnalytics({
  commandContent,
  args,
  currentTime = new Date().getTime(),
  commandClass,
}: StartOptions): Promise<void> {
  let startCommand: string = commandContent.command
  if (commandClass && Object.prototype.hasOwnProperty.call(commandClass, 'analyticsNameOverride')) {
    startCommand = (commandClass as typeof BaseCommand).analyticsNameOverride() ?? commandContent.command
  }

  await metadata.addSensitive(() => ({
    commandStartOptions: {
      startTime: currentTime,
      startCommand,
      startArgs: args,
    },
  }))

  await metadata.addPublic(() => ({
    cmd_all_launcher: packageManagerUsedForCreating(),
    cmd_all_alias_used: commandContent.alias,
    cmd_all_topic: commandContent.topic,
    cmd_all_plugin: commandClass?.plugin?.name,
  }))
}

interface EnvironmentData {
  uname: string
  env_ci: boolean
  env_ci_platform?: string
  env_plugin_installed_any_custom: boolean
  env_plugin_installed_shopify: string
  env_shell: string
  env_web_ide: string | undefined
  env_device_id: string
  env_cloud: string
  env_package_manager: string
}

export async function getEnvironmentData(config: Interfaces.Config): Promise<EnvironmentData> {
  const ciPlatform = environment.local.ciPlatform()

  const pluginNames = getPluginNames(config)
  const shopifyPlugins = pluginNames.filter((plugin) => plugin.startsWith('@shopify/'))

  const {platform, arch} = platformAndArch()

  return {
    uname: `${platform} ${arch}`,
    env_ci: ciPlatform.isCI,
    env_ci_platform: ciPlatform.name,
    env_plugin_installed_any_custom: pluginNames.length !== shopifyPlugins.length,
    env_plugin_installed_shopify: JSON.stringify(shopifyPlugins),
    env_shell: config.shell,
    env_web_ide: environment.local.cloudEnvironment().editor
      ? environment.local.cloudEnvironment().platform
      : undefined,
    env_device_id: hashString(await macAddress()),
    env_cloud: environment.local.cloudEnvironment().platform,
    env_package_manager: await getPackageManager(process.cwd()),
  }
}

export async function getSensitiveEnvironmentData(config: Interfaces.Config) {
  return {
    env_plugin_installed_all: JSON.stringify(getPluginNames(config)),
  }
}

function getPluginNames(config: Interfaces.Config) {
  return config.plugins
    .map((plugin) => plugin.name)
    .sort()
    .filter((plugin) => !plugin.startsWith('@oclif/'))
}
