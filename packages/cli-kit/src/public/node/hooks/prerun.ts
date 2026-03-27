import {CLI_KIT_VERSION} from '../../common/version.js'
import {checkForNewVersion, checkForCachedNewVersion} from '../node-package-manager.js'
import {startAnalytics} from '../../../private/node/analytics.js'
import {outputDebug, outputWarn} from '../output.js'
import {getOutputUpdateCLIReminder} from '../upgrade.js'
import Command from '../base-command.js'
import {runAtMinimumInterval} from '../../../private/node/conf-store.js'
import {fetchNotificationsInBackground} from '../notifications-system.js'
import {isPreReleaseVersion} from '../version.js'
import {reportAnalyticsEvent} from '../analytics.js'
import {postRunHookHasCompleted} from './postrun.js'
import {normalizeStoreFqdn} from '../context/fqdn.js'
import {hashString} from '../crypto.js'
import * as metadata from '../metadata.js'
import {Hook, Interfaces} from '@oclif/core'

export declare interface CommandContent {
  command: string
  topic?: string
  alias?: string
}
// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (options) => {
  const commandContent = parseCommandContent({
    id: options.Command.id,
    aliases: options.Command.aliases,
    pluginAlias: options.Command.plugin?.alias,
  })
  const args = options.argv
  await warnOnAvailableUpgrade()
  outputDebug(`Running command ${commandContent.command}`)
  await startAnalytics({commandContent, args, commandClass: options.Command as unknown as typeof Command})
  await extractStoreMetadata(options.argv)
  interceptProcessExit(options.config)
  fetchNotificationsInBackground(options.Command.id)
}

export function parseCommandContent(cmdInfo: {id: string; aliases: string[]; pluginAlias?: string}): CommandContent {
  let commandContent = parseCreateCommand(cmdInfo.pluginAlias)
  commandContent ??= parseNormalCommand(cmdInfo.id, cmdInfo.aliases)
  return commandContent
}

function parseNormalCommand(id: string, aliases: string[]): CommandContent {
  return {
    command: id.replace(/:/g, ' '),
    topic: parseTopic(id),
    alias: findAlias(aliases),
  }
}

/**
 * Create commands implement Init by default, so the name of the command must be extracted from
 * the plugin/module name. Neither alias or topic are supported
 *
 * @param commandClass - Oclif command configuration
 * @returns Command content with the name of the command or undefined otherwise
 */
function parseCreateCommand(pluginAlias?: string): CommandContent | undefined {
  if (!pluginAlias?.startsWith('@shopify/create-')) {
    return undefined
  }

  return {command: pluginAlias.substring(pluginAlias.indexOf('/') + 1)}
}

/**
 * Commands use this pattern topic:subtopic1:...:subtopicN:command. This method extract the topic and subtopic
 * information replacing the ':' separator with one space
 *
 * @param cmd - Complete command string to extract the topic information
 * @returns The topic name or undefined otherwise
 */
function parseTopic(cmd: string) {
  if (cmd.lastIndexOf(':') === -1) {
    return
  }
  return cmd.slice(0, cmd.lastIndexOf(':')).replace(/:/g, ' ')
}

/**
 * Identifies if the command was launched using an alias instead of the oficial command name
 *
 * @param aliases - List of possible alias a command has
 * @returns The alias used or undefined otherwise
 */
function findAlias(aliases: string[]) {
  const existingAlias = aliases.find((alias) =>
    alias.split(':').every((aliasToken) => process.argv.includes(aliasToken)),
  )
  if (existingAlias) {
    return existingAlias.replace(/:/g, ' ')
  }
}

export function interceptProcessExit(config: Interfaces.Config): void {
  const originalExit = process.exit.bind(process) as (code?: number) => never
  // @ts-expect-error - overriding process.exit signature
  process.exit = (code?: number) => {
    process.exit = originalExit
    if (!postRunHookHasCompleted()) {
      process.exitCode = code ?? 0
      reportAnalyticsEvent({config, exitMode: code === 0 ? 'ok' : 'unexpected_error'}).finally(() => {
        originalExit(code)
      })
      return
    }
    originalExit(code)
  }
}

export async function extractStoreMetadata(argv: string[]): Promise<void> {
  let store: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if ((arg === '--shop' || arg === '-s') && argv[i + 1]) {
      store = argv[i + 1]
      break
    }
    if (arg.startsWith('--shop=')) {
      store = arg.slice('--shop='.length)
      break
    }
  }
  if (!store) {
    store = process.env.SHOPIFY_SHOP
  }
  if (!store) return

  try {
    const storeFqdn = normalizeStoreFqdn(store)
    await metadata.addPublicMetadata(() => ({store_fqdn_hash: hashString(storeFqdn)}))
    await metadata.addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
  } catch {
    // noop - store normalization may fail for invalid values
  }
}

export async function warnOnAvailableUpgrade(): Promise<void> {
  const cliDependency = '@shopify/cli'
  const currentVersion = CLI_KIT_VERSION
  if (isPreReleaseVersion(currentVersion)) {
    // This is a nightly/snapshot/experimental version, so we don't want to check for updates
    return
  }

  // Check in the background, once daily
  // eslint-disable-next-line no-void
  void checkForNewVersion(cliDependency, currentVersion, {cacheExpiryInHours: 24})

  // Warn if we previously found a new version
  await runAtMinimumInterval('warn-on-available-upgrade', {days: 1}, async () => {
    const newerVersion = checkForCachedNewVersion(cliDependency, currentVersion)
    if (newerVersion) {
      outputWarn(getOutputUpdateCLIReminder(newerVersion))
    }
  })
}
