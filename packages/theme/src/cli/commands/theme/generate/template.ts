import {TEMPLATE_TYPES, TEMPLATE_RESOURCE_TYPES, FILE_TYPES, promptForType} from '../../../utilities/generator.js'
import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {generateTemplate} from '../../../services/generate/templates.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {cwd} from '@shopify/cli-kit/node/path'

export default class GenerateTemplate extends ThemeCommand {
  static summary = 'Creates and adds a new template file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme template](https://shopify.dev/docs/themes/architecture/templates) in your local theme directory.

  The template is created in the \`templates\` directory with the basic structure needed, including schema and settings.

  You can specify the type of template to generate using the \`--type\` flag. The template will be created with appropriate default settings based on the type.`

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
      options: TEMPLATE_TYPES,
      env: 'SHOPIFY_FLAG_TEMPLATE_TYPE',
    }),
    extension: Flags.string({
      char: 'x',
      description: 'File extension (liquid or json)',
      options: FILE_TYPES,
      env: 'SHOPIFY_FLAG_TEMPLATE_FILE_TYPE',
    }),
    resource: Flags.string({
      char: 'r',
      description: 'Resource type for the template',
      options: TEMPLATE_RESOURCE_TYPES,
      env: 'SHOPIFY_FLAG_TEMPLATE_RESOURCE',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(GenerateTemplate)

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
        message: 'Name of the template',
      }))
    const type = flags.type ?? (await promptForType('Type of template', TEMPLATE_TYPES))
    const resource = flags.resource ?? (await promptForType('Resource type for the template', TEMPLATE_RESOURCE_TYPES))
    const fileType = flags.extension ?? (await promptForType('File extension', FILE_TYPES))

    await generateTemplate({
      name,
      type,
      path: flags.path ?? cwd(),
      fileType,
      resource,
    })
  }
}
