import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

const BLOCK_TYPES = ['text', 'image', 'video', 'product', 'collection']

export default class GenerateBlock extends ThemeCommand {
  static summary = 'Creates and adds a new block file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme block](https://shopify.dev/docs/themes/architecture/blocks) in your local theme directory.

  The block is created in the \`blocks\` directory with the basic structure needed, including schema and settings.

  You can specify the type of block to generate using the \`--type\` flag. The block will be created with appropriate default settings based on the type.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    name: Flags.string({
      char: 'n',
      description: 'Name of the block',
      env: 'SHOPIFY_FLAG_BLOCK_NAME',
    }),
    type: Flags.string({
      char: 't',
      description: 'Type of block to generate',
      options: [...BLOCK_TYPES],
      env: 'SHOPIFY_FLAG_BLOCK_TYPE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GenerateBlock)

    if (!flags.force && !(await hasRequiredThemeDirectories(flags.path))) {
      renderWarning({
        body: [
          'The current directory does not contain the required theme directories (config, layout, sections, templates).',
        ],
      })
      return
    }

    const name =
      flags.name ??
      (await renderTextPrompt({
        message: 'Name of the block',
      }))

    const choices = BLOCK_TYPES.map((type) => ({label: type, value: type}))
    const type =
      flags.type ??
      (await renderSelectPrompt({
        message: 'Type of block',
        choices,
      }))

    renderSuccess({
      body: [`Placeholder: Generating block with name: ${name}, type: ${type}`],
    })
  }
}
