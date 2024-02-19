import {hashString} from '../../public/node/crypto.js'
import {getPackageManager, packageManagerFromUserAgent} from '../../public/node/node-package-manager.js'
import BaseCommand from '../../public/node/base-command.js'
import {CommandContent} from '../../public/node/hooks/prerun.js'
import * as metadata from '../../public/node/metadata.js'
import {platformAndArch} from '../../public/node/os.js'
import {Command, Interfaces} from '@oclif/core'
import {ciPlatform, cloudEnvironment, macAddress} from '@shopify/cli-kit/node/context/local'
import {cwd} from '@shopify/cli-kit/node/path'

interface StartOptions {
  commandContent: CommandContent
  args: string[]
  currentTime?: number
  commandClass?: Command.Class | typeof BaseCommand
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

  await metadata.addSensitiveMetadata(() => ({
    commandStartOptions: {
      startTime: currentTime,
      startCommand,
      startArgs: args,
    },
  }))

  await metadata.addPublicMetadata(() => ({
    cmd_all_launcher: packageManagerFromUserAgent(),
    cmd_all_alias_used: commandContent.alias,
    cmd_all_topic: commandContent.topic,
    cmd_all_plugin: commandClass?.plugin?.name,
    cmd_all_force: flagIncluded('force', commandClass) ? args.includes('--force') : undefined,
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
  const ciplatform = ciPlatform()

  const pluginNames = getPluginNames(config)
  const shopifyPlugins = pluginNames.filter((plugin) => plugin.startsWith('@shopify/'))

  const {platform, arch} = platformAndArch()

  return {
    uname: `${platform} ${arch}`,
    env_ci: ciplatform.isCI,
    env_ci_platform: ciplatform.name,
    env_plugin_installed_any_custom: pluginNames.length !== shopifyPlugins.length,
    env_plugin_installed_shopify: JSON.stringify(shopifyPlugins),
    env_shell: config.shell,
    env_web_ide: cloudEnvironment().editor ? cloudEnvironment().platform : undefined,
    env_device_id: hashString(await macAddress()),
    env_cloud: cloudEnvironment().platform,
    env_package_manager: await getPackageManager(cwd()),
  }
}

export async function getSensitiveEnvironmentData(config: Interfaces.Config) {
  return {
    env_plugin_installed_all: JSON.stringify(getPluginNames(config)),
  }
}

function getPluginNames(config: Interfaces.Config) {
  const pluginNames = [...config.plugins.keys()]
  return pluginNames.sort().filter((plugin) => !plugin.startsWith('@oclif/'))
}

function flagIncluded(flag: string, commandClass?: Command.Class | typeof BaseCommand) {
  if (!commandClass) return false

  const commandFlags = commandClass.flags ?? {}
  return Object.keys(commandFlags).includes(flag)
}
