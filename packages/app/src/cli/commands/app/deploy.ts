import {appFlags} from '../../flags.js'
import {deploy} from '../../services/deploy.js'
import {AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {path, cli} from '@shopify/cli-kit'

export default class Deploy extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Deploy)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory)
    await deploy({app, reset: flags.reset})
  }
}
