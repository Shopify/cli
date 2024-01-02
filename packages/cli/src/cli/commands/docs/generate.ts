import Command from '@shopify/cli-kit/node/base-command'
import {Command as oclifCommand} from '@oclif/core'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class Catalog extends Command {
  static description = 'Generate CLI commands documentation'
  static hidden = true

  async run(): Promise<void> {
    const commands = this.config.commands
    // Short by length to ensure that we first generate the interfaces for the parent topics to detect hidden ones.
    const shortedCommands = commands.sort((ca, cb) => ca.id.length - cb.id.length)
    const promises = shortedCommands.flatMap((command) => [
      writeCommandFlagInterface(command),
      writeCommandDocumentation(command),
    ])

    await Promise.all(promises)
  }
}

const hiddenTopics: string[] = []
const path = joinPath(cwd(), '/src-docs')

function isHidden(command: oclifCommand.Loadable) {
  // Some commands rely on the hidden property of the parent topic, but is not returned in the oclif command object
  if (command.hidden) {
    hiddenTopics.push(command.id)
    return true
  }

  // User plugins are installed locally and are not part of the Shopify CLI documentation
  if (command.pluginType === 'user') return true
  return hiddenTopics.some((topic) => command.id.startsWith(topic))
}

async function writeCommandDocumentation(command: oclifCommand.Loadable) {
  if (isHidden(command)) return
  const commandName = command.id.replace(/[:]/g, ' ')
  const fileName = command.id.replace(/[:]/g, '-')
  const interfaceName = command.id.replace(/[:-]/g, '')
  const hasTopic = command.id.includes(':')
  const topic = command.id.split(':')[0]
  const string = `import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: '${commandName}',
  description: \`${command.description?.replace(/`/g, '\\`')}\`,
  overviewPreviewDescription: \`${command.summary ?? command.description}\`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: '${commandName}',
          code: './examples/${fileName}.example.sh',
          language: 'bash',
        },
      ],
      title: '${commandName}',
    },
  },
  definitions: [
    {
      title: '${commandName}',
      description: 'The following flags are available for the \`${commandName}\` command:',
      type: '${interfaceName}',
    },
  ],
  category: 'Commands',
  subCategory: ${hasTopic ? `'${topic}'` : `'common'`},
  related: [
  ],
}

export default data`

  await writeFile(`${path}/${fileName}.doc.ts`, string)
  await mkdir(`${path}/examples`)
  await writeFile(`${path}/examples/${fileName}.example.sh`, (command.usage as string) ?? 'no usage')
  outputInfo(`Generated docs for ${commandName}`)
}

async function writeCommandFlagInterface(command: oclifCommand.Loadable) {
  if (isHidden(command)) return

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
  const fileName = command.id.replace(/[:]/g, '-')
  const commandContent = `export interface ${commandName} {
${flagsDetails}
}
`
  await mkdir(`${path}/interfaces`)
  await writeFile(`${path}/interfaces/${fileName}.interface.ts`, commandContent)
}
