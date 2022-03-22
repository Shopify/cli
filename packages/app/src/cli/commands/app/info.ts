import {load as loadApp, App} from '../../models/app/app'
import {Command, Flags} from '@oclif/core'
import {output, path} from '@shopify/cli-kit'

export default class AppInfo extends Command {
  static description = 'Print basic information about your app and blocks'

  static flags = {
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppInfo)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    output.info(output.content`${JSON.stringify(app, null, 2)}`)
  }
}
