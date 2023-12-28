import Command from '@shopify/cli-kit/node/base-command'
import {Command as oclifCommand} from '@oclif/core'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class Catalog extends Command {
  static description = 'Generate commands interfaces for the Shopify Documentation'
  static hidden = true

  async run(): Promise<void> {
    const commands = this.config.commands
    // Short by length to ensure that we first generate the interfaces for the parent topics to detect hidden ones.
    const shortedCommands = commands.sort((ca, cb) => ca.id.length - cb.id.length)
    const results = shortedCommands.map((command) => writeCommand(command))
    await Promise.all(results)
  }
}

const hiddenTopics: string[] = []

async function writeCommand(command: oclifCommand.Loadable) {
  // Some commands rely on the hidden property of the parent topic, but is not returned in the oclif command object
  if (command.hidden) {
    hiddenTopics.push(command.id)
    return
  }
  if (hiddenTopics.some((topic) => command.id.startsWith(topic))) return

  const flagsDetails = Object.keys(command.flags)
    .map((flagName) => {
      const flag = command.flags[flagName]
      if (!flag) return
      if (flag.hidden) return
      const flagDescription = flag.description || ''
      const char = flag.char ? `-${flag.char}, ` : ''
      const type = flag.type === 'option' ? 'string' : "''"
      const value = flag.type === 'option' ? ' <value>' : ''
      const optional = flag.required ? '' : '?'
      const flagContent = `  /**
   * ${flagDescription}
   */
  '${char}--${flagName}${value}'${optional}: ${type}`
      // Example output: '-c, --config <value>'?: string
      return flagContent
    })
    .filter((str) => str && str?.length > 0)
    .join('\n\n')

  const commandName = command.id.replace(/[:-]/g, '')
  const commandContent = `export interface ${commandName} {
${flagsDetails}
}
`

  const path = joinPath(cwd(), '/src-docs/commandInterfaces')
  await writeFile(`${path}/${commandName}.ts`, commandContent)
  outputInfo(`Generated ${commandName}.ts`)
}
