import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

const SECTION_TYPES = ['featured-collection', 'image-with-text', 'rich-text', 'custom']

export default class GenerateSection extends ThemeCommand {
  static summary = 'Creates and adds a new section file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme section](https://shopify.dev/docs/themes/architecture/sections) in your local theme directory.

  The section is created in the \`sections\` directory with the basic structure needed, including schema, settings, and blocks.

  You can specify the type of section to generate using the \`--type\` flag. The section will be created with appropriate default settings and blocks based on the type.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    name: Flags.string({
      char: 'n',
      description: 'Name of the section',
      env: 'SHOPIFY_FLAG_SECTION_NAME',
    }),
    type: Flags.string({
      char: 't',
      description: 'Type of section to generate',
      options: [...SECTION_TYPES],
      env: 'SHOPIFY_FLAG_SECTION_TYPE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GenerateSection)

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
        message: 'Name of the section',
      }))

    const choices = SECTION_TYPES.map((type) => ({label: type, value: type}))
    const type =
      flags.type ??
      (await renderSelectPrompt({
        message: 'Type of section',
        choices,
      }))

    renderSuccess({
      body: [`Placeholder: Generating section with name: ${name}, type: ${type}`],
    })
  }
}
