import Command from '@shopify/cli-kit/node/base-command'
import {Command as oclifCommand} from '@oclif/core'
import {writeFile} from '@shopify/cli-kit/node/fs'

export default class Catalog extends Command {
  static description = 'Generate commands interfaces for the Shopify Documentation'
  static hidden = true

  async run(): Promise<void> {
    const commands = this.config.commands
    for (const command of commands) {
      writeCommand(command)
    }
  }
}

async function writeCommand(command: oclifCommand.Loadable) {
  const commandName = command.id.replace(':', '')
  const flags = Object.keys(command.flags)
  // const commandPath = joinPath(path, `${commandName}.md`)
  const flagDetails = flags
    .map((flagName) => {
      const flag = command.flags[flagName]
      if (!flag) return
      if (flag.hidden) return
      const flagDescription = flag.description || ''
      const flagContent = `
  /**
   * ${flagDescription}
   */
  '--${flagName}'?: string
`
      return flagContent
    })
    .join('\n')
  const commandContent = `
export interface ${commandName} {
  ${flagDetails}
}
---
`

  const path = '../../../../../src-docs/commandTypes'
  await writeFile(`${path}/${commandName}.ts`, commandContent)
  return 1
}
