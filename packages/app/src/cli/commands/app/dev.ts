import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'
import dev from '$cli/services/dev'
import {load as loadApp, App} from '$cli/models/app/app'
import {normalizeStoreName} from '$cli/utilities/dev/normalize-store'

export default class Dev extends Command {
  static description = 'Develop a block or an app'

  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your app directory',
      env: 'SHOPIFY_FLAG_APP_PATH',
    }),
    store: Flags.string({
      hidden: false,
      description: 'the store you want to dev to',
      env: 'SHOPIFY_FLAG_DEV_STORE',
      parse: (input, _) => Promise.resolve(normalizeStoreName(input)),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await dev({app, store: flags.store})
  }
}
