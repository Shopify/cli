import {start} from '../../analytics.js'
import {debug} from '../../output.js'
import Command from '../base-command.js'
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
  await start({commandContent, args, commandClass: options.Command as unknown as typeof Command})
}

function parseNormalCommand(commandClass: Interfaces.Command.Class): CommandContent {
  return {
    command: commandClass.id.replace(/:/g, ' '),
    topic: parseTopic(commandClass.id),
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

function parseTopic(cmd: string) {
  if (cmd.lastIndexOf(':') === -1) {
    return
  }
  return cmd.slice(0, cmd.lastIndexOf(':')).replace(/:/g, ' ')
}

function findAlias(aliases: string[]) {
  const existingAlias = aliases.find((alias) =>
    alias.split(':').every((aliasToken) => process.argv.includes(aliasToken)),
  )
  if (existingAlias) {
    return existingAlias.replace(/:/g, ' ')
  }
}
