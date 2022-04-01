import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'
import dev from '$cli/services/dev'
import {load as loadApp, App} from '$cli/models/app/app'

export default class Dev extends Command {
  static description = 'Run the app'

  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'The path to your app directory.',
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await dev({app})
  }
}
