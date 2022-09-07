import {hydrogenFlags} from '../../flags.js'
import {deployToOxygen} from '../../services/deploy.js'
import {output, cli, environment, path} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'

export default class Deploy extends Command {
  static description = 'Deploy your Hydrogen app to Oxygen hosting'
  static hidden = true

  static flags = {
    ...cli.globalFlags,
    ...hydrogenFlags,
    deploymentToken: Flags.string({
      required: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_DEPLOYMENT_TOKEN',
      description: 'Specify your Oxygen deployment token.',
    }),
    commitMessage: Flags.string({
      env: 'SHOPIFY_HYDROGEN_FLAG_COMMIT_MESSAGE',
      description: 'Override the default Git commit message.',
    }),
    commitAuthor: Flags.string({
      env: 'SHOPIFY_HYDROGEN_FLAG_COMMIT_AUTHOR',
      description: 'Override the default Git commit author.',
    }),
    healthCheck: Flags.boolean({
      env: 'SHOPIFY_HYDROGEN_FLAG_HEALTH_CHECK',
      default: true,
      description: 'Require a health check before the deployment succeeds.',
    }),
    dmsAddress: Flags.string({
      hidden: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_DMS_ADDRESS',
      default: 'oxygen-dms.shopifycloud.com',
    }),
  }

  public async run(): Promise<void> {
    const isShopify = await environment.local.isShopify()
    if (!isShopify) {
      output.warn('Command coming soon...')
      return
    }

    const {flags} = await this.parse(Deploy)
    const dir = flags.path ? path.resolve(flags.path) : process.cwd()

    await deployToOxygen({...flags, path: dir})
  }
}
