import {start} from '../../analytics.js'
import {debug} from '../../output.js'
import {Hook, Interfaces} from '@oclif/core'

export declare interface CommandContent {
  command: string
  topic?: string
  alias?: string
}
// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (options) => {
  let commandContent = parseCreateCommand(options.Command)
  if (!commandContent) {
    commandContent = parseNormalCommand(options.Command)
  }
  const args = options.argv
  debug(`Running command ${commandContent.command}`)
  await start({commandContent, args, commandClass: options.Command})
}

function parseNormalCommand(commandClass: Interfaces.Command.Class): CommandContent {
  const parsedData = parseTopicAndCommand(commandClass.id)
  return {
    command: parsedData.command,
    topic: parsedData.topic,
    alias: findAlias(commandClass.aliases),
  }
}

// Create commands implement Init by default, so the name of the command must be extracted from
// the plugin/module name. Niether alias or topic are supported
function parseCreateCommand(commandClass: Interfaces.Command.Class): CommandContent | undefined {
  if (!commandClass.plugin?.alias || !commandClass.plugin?.alias.startsWith('@shopify/create-')) {
    return undefined
  }

  return {command: commandClass.plugin?.alias.substring(commandClass.plugin?.alias.indexOf('/') + 1)}
}

function parseTopicAndCommand(cmd: string): {topic?: string; command: string} {
  let command = cmd
  let topic
  if (cmd.lastIndexOf(':') !== -1) {
    command = cmd.slice(cmd.lastIndexOf(':') + 1)
    topic = cmd.slice(0, cmd.lastIndexOf(':')).replace(/:/g, ' ')
  }
  return {topic, command}
}

function findAlias(aliases: string[]) {
  const existingAlias = aliases.find((alias) =>
    alias.split(':').every((aliasToken) => process.argv.includes(aliasToken)),
  )
  if (existingAlias) {
    const existingAliasTokens = existingAlias.split(':')
    return existingAliasTokens[existingAliasTokens.length - 1]
  }
}
