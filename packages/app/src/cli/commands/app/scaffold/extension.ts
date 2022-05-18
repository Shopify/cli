import {appFlags} from '../../../flags'
import {extensions} from '../../../constants'
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension'
import {load as loadApp, App} from '../../../models/app/app'
import scaffoldExtensionService from '../../../services/scaffold/extension'
import {output, path, cli} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: 'Extension type',
      options: extensions.types,
      env: 'SHOPIFY_FLAG_EXTENSION_TYPE',
    }),
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your Extension',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'clone-url': Flags.string({
      hidden: true,
      char: 'u',
      description:
        'The Git URL to clone the function extensions templates from. Defaults to: https://github.com/Shopify/scripts-apis-examples',
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
    language: Flags.string({
      hidden: true,
      char: 'l',
      options: ['wasm', 'rust', 'typescript'],
      description: 'Language of the template',
      env: 'SHOPIFY_FLAG_LANGUAGE',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      name: flags.name,
    })
    const {extensionType, name} = promptAnswers
    await scaffoldExtensionService({
      ...promptAnswers,
      app,
      cloneUrl: flags['clone-url'],
      language: flags.language,
    })
    output.info(output.content`Extension ${name} generated successfully!`)
  }
}
