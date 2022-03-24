import {load as loadApp, App} from '../../models/app/app'
import devInit from '../../services/dev.service'
import {Command, Flags} from '@oclif/core'
import {output, path} from '@shopify/cli-kit'

export default class Dev extends Command {
  static description = 'Develop a block or an app'

  static flags = {
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    console.log(app)
    await devInit({app})
  }
}
