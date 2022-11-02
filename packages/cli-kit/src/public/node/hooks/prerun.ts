import {start} from '../../../analytics.js'
import {debug} from '../../../output.js'
import Command from '../../../public/node/base-command.js'
import {Hook} from '@oclif/core'

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
  debug(`Running command ${commandContent.command}`)
  await start({commandContent, args, commandClass: options.Command as unknown as typeof Command})
}

export function parseCommandContent(cmdInfo: {id: string; aliases: string[]; pluginAlias?: string}) {
  let commandContent = parseCreateCommand(cmdInfo.pluginAlias)
  if (!commandContent) {
    commandContent = parseNormalCommand(cmdInfo.id, cmdInfo.aliases)
  }
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
  if (!pluginAlias || !pluginAlias.startsWith('@shopify/create-')) {
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
