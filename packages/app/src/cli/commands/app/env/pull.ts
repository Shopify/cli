import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {pullEnv} from '../../../services/app/env/pull.js'
import Command from '../../../utilities/app-command.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {output} from '@shopify/cli-kit'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class EnvPull extends Command {
  static description = 'Pull app and extensions environment variables.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'env-file': Flags.string({
      hidden: false,
      description: 'Specify an environment file to update if the update flag is set',
      env: 'SHOPIFY_FLAG_ENV_FILE',
      default: '.env',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvPull)
    const directory = flags.path ? resolvePath(flags.path) : process.cwd()
    const envFile = resolvePath(directory, flags['env-file'])
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications, mode: 'report'})
    output.info(await pullEnv(app, {envFile}))
  }
}
