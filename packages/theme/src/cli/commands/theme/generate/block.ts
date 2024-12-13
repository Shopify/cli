import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {generateBlock} from '../../../services/generate/blocks.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

export default class GenerateBlock extends ThemeCommand {
  static summary = 'Creates and adds a new block file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme block](https://shopify.dev/docs/themes/architecture/blocks) in your local theme directory.

  The block is created in the \`blocks\` directory with the basic structure needed, including schema and settings.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    name: Flags.string({
      char: 'n',
      description: 'Name of the block',
      env: 'SHOPIFY_FLAG_BLOCK_NAME',
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

    await generateBlock({
      name,
      path: flags.path ?? '.',
    })
  }
}
