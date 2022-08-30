import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import {populateEnv} from '../../services/env/populate.js'
import {Flags} from '@oclif/core'
import {output, path, cli} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'

export default class WebEnv extends Command {
  static description = 'Print basic information about your app and extensions'

  static hidden = true

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    'no-update': Flags.boolean({
      hidden: false,
      description: 'Wether to update the environment file',
      env: 'SHOPIFY_FLAG_NO_UPDATE_ENV',
      default: false,
    }),
    'env-file': Flags.string({
      hidden: false,
      description: 'Specify an environment file to update if the update flag is set',
      env: 'SHOPIFY_FLAG_ENV_FILE',
      default: '.env',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(WebEnv)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const envFile = path.resolve(directory, flags['env-file'])
    const app: AppInterface = await loadApp(directory, 'report')
    output.info(await populateEnv(app, {noUpdate: flags['no-update'], envFile}))
    if (app.errors) process.exit(2)
  }
}
