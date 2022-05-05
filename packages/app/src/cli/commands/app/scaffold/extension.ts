import {appFlags} from '../../../flags'
import {output, path, cli, error} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'
import {extensions, limitedExtensions} from '$cli/constants'
import scaffoldExtensionPrompt from '$cli/prompts/scaffold/extension'
import {load as loadApp, App} from '$cli/models/app/app'
import scaffoldExtensionService from '$cli/services/scaffold/extension'

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
    const {flags} = await this.parse(AppScaffoldExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)

    this.validateType(app, flags.type)

    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      ignoreExtensions: this.limitedExtensionsAlreadyScaffolded(app),
      name: flags.name,
    })

    await scaffoldExtensionService({
      ...promptAnswers,
      app,
      cloneUrl: flags['clone-url'],
      language: flags.language,
    })
    output.info(output.content`Extension ${promptAnswers.name} generated successfully!`)
  }

  /**
   * If the type passed as flag is not valid because it has already been scaffolded
   * and we do not allow multiple extensions of that type, throw an error
   * @param app {App} current App
   * @param type {string} extension type
   */
  validateType(app: App, type: string | undefined) {
    if (type && this.limitedExtensionsAlreadyScaffolded(app).includes(type)) {
      throw new error.Abort('Invalid extension type', `You can only scaffold one extension of type ${type} per app`)
    }
  }

  /**
   * Some extension types like `theme` and `product_subscription` are limited to one per app
   * Use this method to retrieve a list of the limited types that have already been scaffolded
   *
   * @param app {App} current App
   * @returns {string[]} list of extensions that are limited by quantity and are already scaffolded
   */
  limitedExtensionsAlreadyScaffolded(app: App): string[] {
    const themeTypes: string[] = app.extensions.theme.map((ext) => ext.configuration.type)
    const uiTypes: string[] = app.extensions.ui.map((ext) => ext.configuration.type)

    const themeExtensions = themeTypes.filter((type) => limitedExtensions.theme.includes(type))
    const uiExtensions = uiTypes.filter((type) => limitedExtensions.ui.includes(type))
    return [...themeExtensions, ...uiExtensions]
  }
}
