import {TEMPLATE_TYPES, promptForType} from '../../../utilities/generator.js'
import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export default class GenerateTemplate extends ThemeCommand {
  static summary = 'Creates and adds a new template file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme template](https://shopify.dev/docs/themes/architecture/templates) in your local theme directory.

  The template is created in the \`templates\` directory with the basic structure needed, including layout and content sections.

  You can specify the type of template to generate using the \`--type\` flag. The template will be created with appropriate default sections based on the type.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    name: Flags.string({
      char: 'n',
      description: 'Name of the template',
      env: 'SHOPIFY_FLAG_TEMPLATE_NAME',
    }),
    type: Flags.string({
      char: 't',
      description: 'Type of template to generate',
      options: [...TEMPLATE_TYPES],
      env: 'SHOPIFY_FLAG_TEMPLATE_TYPE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GenerateTemplate)

    const name =
      flags.name ??
      (await renderTextPrompt({
        message: 'Name of the template',
      }))

    const type = flags.type ?? (await promptForType('Type of template', TEMPLATE_TYPES))

    renderSuccess({
      body: [`Placeholder: Generating template with name: ${name}, type: ${type}`],
    })
  }
}
