import {uiExtensions} from '../../../constants'
import scaffoldUiExtensionPrompt from '../../../prompts/scaffold/ui-extension'
import {load as loadApp, App} from '../../../models/app/app'
import scaffoldUiExtensionService from '../../../services/scaffold/ui-extension'
import {output, path} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class AppScaffoldUiExtension extends Command {
  static description = 'Scaffold a UI Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    type: Flags.string({
      char: 't',
      hidden: false,
      description: 'UI Extension type',
      options: uiExtensions.types,
    }),
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your UI Extension',
    }),
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldUiExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const parentApp: App = await loadApp(directory)
    const promptAnswers = await scaffoldUiExtensionPrompt({
      uiExtensionType: flags.type,
      name: flags.name,
    })
    const {uiExtensionType, name} = promptAnswers
    await scaffoldUiExtensionService({
      ...promptAnswers,
      parentApp,
    })
    output.info(output.content`UI Extension ${name} generated successfully!`)
  }
}
