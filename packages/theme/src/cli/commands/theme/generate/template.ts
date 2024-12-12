import {
  TEMPLATE_RESOURCE_TYPES,
  FILE_TYPES,
  promptForType,
  checkBaseTemplateExists,
} from '../../../utilities/generator.js'
import {themeFlags} from '../../../flags.js'
import ThemeCommand from '../../../utilities/theme-command.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {generateTemplate} from '../../../services/generate/templates.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

export default class GenerateTemplate extends ThemeCommand {
  static summary = 'Creates and adds a new template file to your local theme directory'

  static descriptionWithMarkdown = `Creates a new [theme template](https://shopify.dev/docs/themes/architecture/templates) in your local theme directory.

  The template is created in the \`templates\` directory with the basic structure needed, including schema and settings.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    name: Flags.string({
      char: 'n',
      description: 'Name of the template',
      env: 'SHOPIFY_FLAG_TEMPLATE_NAME',
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

    const resource = flags.resource ?? (await promptForType('Resource type for the template', TEMPLATE_RESOURCE_TYPES))
    const fileType = flags.extension ?? (await promptForType('File extension', FILE_TYPES))
    const path = flags.path

    const name = await resolveTemplateName(flags.name, resource, fileType, path)

    await generateTemplate({
      name,
      path,
      fileType,
      resource,
    })
  }
}

async function resolveTemplateName(
  name: string | undefined,
  resource: string,
  fileType: string,
  path: string,
): Promise<string | undefined> {
  const baseTemplateExists = await checkBaseTemplateExists({resource, fileType, path})
  if (!baseTemplateExists) {
    return undefined
  }

  return name ?? renderTextPrompt({message: 'Name of the template'})
}
