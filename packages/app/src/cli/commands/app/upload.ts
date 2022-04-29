import {upload as uploadService} from '../../services/upload'
import {load as loadApp, App} from '../../models/app/app'
import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'

export default class Upload extends Command {
  static description = 'Deploy the app'

  static flags = {
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your UI Extension',
    }),
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
      required: true,
    }),
    file: Flags.string({
      char: 'f',
      hidden: true,
      required: true,
      description: 'the path to the app bundle',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Upload)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const parentApp: App = await loadApp(directory)
    await uploadService(parentApp.configuration.name, flags.file)
  }
}
