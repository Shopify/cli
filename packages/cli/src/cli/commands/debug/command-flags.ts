import Command from '@shopify/cli-kit/node/base-command'
import {renderTable, renderText} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class CommandFlags extends Command {
  static description = 'View all the available command flags'
  static hidden = true

  static flags = {
    // Similar options as the `commands` command from `plugin-commands`
    csv: Flags.boolean({
      description: 'Output as CSV',
      env: 'SHOPIFY_FLAG_OUTPUT_CSV',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CommandFlags)

    const data: {pluginName: string; command: string; flagName: string; flagChar: string; flagEnv?: string}[] = []
    for (const [_, plugin] of this.config.plugins) {
      for (const command of plugin.commands) {
        // We have to load the command, otherwise OCLIF will just use the manifest, and we need the actual class
        // eslint-disable-next-line no-await-in-loop
        const loaded = await command.load()

        let pluginName
        if (plugin.name.startsWith('@shopify')) {
          pluginName = plugin.name.substring('@shopify/'.length)
        } else {
          pluginName = plugin.name.startsWith('@oclif') ? plugin.name.substring('@oclif/'.length) : plugin.name
        }

        const flags = loaded.flags
        if (flags) {
          for (const [flagName, flagConfig] of Object.entries(flags)) {
            data.push({
              pluginName,
              command: command.id,
              flagName: `--${flagName}`,
              flagChar: flagConfig.char ? `-${flagConfig.char}` : '',
              flagEnv: flagConfig.env,
            })
          }
        }
      }
    }

    if (flags.csv) {
      const columns = ['pluginName', 'command', 'flagName', 'flagChar', 'flagEnv'] as const
      const header = `${columns.join(',')}\n`
      const rows = data.map((obj) => columns.map((key) => obj[key]).join(',')).join('\n')
      const csvString = header + rows
      renderText({text: csvString})
    } else {
      renderTable({
        rows: data,
        columns: {
          pluginName: {
            header: 'plugin',
            color: 'red',
          },
          command: {},
          flagName: {
            header: 'long flag',
            color: 'green',
          },
          flagChar: {
            header: 'short flag',
            color: 'green',
          },
          flagEnv: {
            header: 'env variable',
            color: 'blueBright',
          },
        },
      })
    }
  }
}
