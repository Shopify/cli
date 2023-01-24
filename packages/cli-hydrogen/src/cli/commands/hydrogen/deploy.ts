import {hydrogenFlags} from '../../flags.js'
import {deployToOxygen} from '../../services/deploy.js'
import * as output from '@shopify/cli-kit/node/output'
import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {isShopify} from '@shopify/cli-kit/node/environment/local'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Deploy extends Command {
  static description = 'Deploy your Hydrogen app to Oxygen hosting'
  static hidden = true

  static flags = {
    ...globalFlags,
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
    pathToBuild: Flags.string({
      hidden: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_PATH_TO_BUILD',
      description: 'Skip build process and use provided value as build',
    }),
    healthCheck: Flags.boolean({
      env: 'SHOPIFY_HYDROGEN_FLAG_HEALTH_CHECK',
      default: true,
      description: 'Require a health check before the deployment succeeds.',
    }),
    assumeYes: Flags.boolean({
      char: 'y',
      env: 'SHOPIFY_HYDROGEN_FLAG_ASSUME_YES',
      default: false,
      description: 'Automatic yes to prompts. Assume "yes" as answer to all prompts and run non-interactively.',
    }),
    oxygenAddress: Flags.string({
      hidden: true,
      env: 'SHOPIFY_HYDROGEN_FLAG_OXYGEN_ADDRESS',
      default: 'oxygen-dms.shopifycloud.com',
    }),
  }

  public async run(): Promise<void> {
    const isShopifolk = await isShopify()
    if (!isShopifolk) {
      output.warn('Command coming soon...')
      return
    }

    const {flags} = await this.parse(Deploy)
    const dir = flags.path ? resolvePath(flags.path) : cwd()

    await deployToOxygen({...flags, path: dir})
  }
}
