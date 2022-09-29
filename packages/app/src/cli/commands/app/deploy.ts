import {appFlags} from '../../flags.js'
import {deploy} from '../../services/deploy.js'
import {AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {path, cli, metadata} from '@shopify/cli-kit'

export default class Deploy extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Deploy)

    await metadata.addPublic(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory)
    await deploy({app, apiKey: flags['api-key'], reset: flags.reset})
  }
}
