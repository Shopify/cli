import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'
import {App, load as loadApp} from '$cli/models/app/app'
import build from '$cli/services/build'

export default class Build extends Command {
  static description = 'Build the app'

  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your app directory',
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await build({app})
  }
}
