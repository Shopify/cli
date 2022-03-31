import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'
import dev from '$cli/services/dev'
import {load as loadApp, App} from '$cli/models/app/app'

export default class Dev extends Command {
  static description = 'Develop a block or an app'

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your app directory.',
      env: 'SHOPIFY_FLAG_PATH',
    }),
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    store: Flags.string({
      hidden: false,
      description: 'Development store URL. Must be an existing development store.',
      env: 'SHOPIFY_FLAG_STORE',
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
    'no-tunnel': Flags.boolean({
      hidden: false,
      description: 'Skips creating an HTTP tunnel.',
      env: 'SHOPIFY_FLAG_NO_TUNNEL',
      default: false,
    }),
    'no-update': Flags.boolean({
      hidden: false,
      description: 'Skips the dashboard URL update step.',
      env: 'SHOPIFY_FLAG_NO_UPDATE',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const appInfo: App = await loadApp(directory)

    await dev({
      appInfo,
      apiKey: flags['api-key'],
      store: flags.store,
      reset: flags.reset,
      noTunnel: flags['no-tunnel'],
      noUpdate: flags['no-update'],
    })
  }
}
