import {info} from '../../services/info.js'
import {load as loadApp, HydrogenApp} from '../../models/hydrogen.js'
import {hydrogenFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class Info extends Command {
  static description = 'Print basic information about your hydrogen app.'

  static flags = {
    ...globalFlags,
    ...hydrogenFlags,
    showToken: Flags.boolean({
      hidden: false,
      description: 'Show storefront API token',
      default: false,
      env: 'SHOPIFY_HYDROGEN_FLAG_SHOW_TOKEN',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Info)
    const directory = flags.path ? resolvePath(flags.path) : cwd()
    const app: HydrogenApp = await loadApp(directory)

    outputInfo(info(app, {showPrivateData: flags.showToken}))
    if (app.errors) process.exit(2)
  }
}
