import {hydrogenFlags} from '../../flags.js'
import {deployToOxygen} from '../../services/deploy.js'
import {output, cli, environment} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'

export default class Deploy extends Command {
  static description = 'Deploy your Hydrogen app to Oxygen'
  static hidden = true

  // note: we may want to check for the environment variable OXYGEN_DEPLOYMENT_TOKEN as a fallback when
  // we are in a workflow
  static flags = {
    ...cli.globalFlags,
    ...hydrogenFlags,
    deploymentToken: Flags.string({
      char: 'd',
      required: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_DEPLOYMENT_TOKEN',
      description: 'The deployment token allowing you to deploy to Oxygen.',
    }),
    commitMessage: Flags.string({
      char: 'm',
      env: 'SHOPIFY_HYDROGEN_FLAG_COMMIT_MESSAGE',
      description: 'Overwrite the default Git commit message.',
    }),
    commitAuthor: Flags.string({
      char: 'a',
      env: 'SHOPIFY_HYDROGEN_FLAG_COMMIT_AUTHOR',
      description: 'Overwrite the default Git commit author.',
    }),
    dmsAddress: Flags.string({
      hidden: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_DMS_ADDRESS',
      default: 'https://oxygen-dms.shopifycloud.com',
    }),
    healthCheck: Flags.boolean({
      env: 'SHOPIFY_HYDROGEN_FLAG_HEALTH_CHECK',
      default: true,
      description: 'Require a health check before the deployment succeeds.',
    }),
  }

  public async run(): Promise<void> {
    const isShopify = await environment.local.isShopify()
    if (!isShopify) {
      output.warn('Command coming soon...')
      return
    }

    const {flags} = await this.parse(Deploy)
    await deployToOxygen(flags)
  }
}
