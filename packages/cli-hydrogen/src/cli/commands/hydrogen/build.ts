import {build} from '../../services/build.js'
import {hydrogenFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

const PLATFORM_ENTRIES = {
  node: `@shopify/hydrogen/platforms/node`,
  worker: `@shopify/hydrogen/platforms/worker`,
}

export default class Build extends Command {
  static description = 'Builds a Hydrogen storefront for production.'
  static flags = {
    ...globalFlags,
    path: hydrogenFlags.path,
    base: Flags.string({
      description: ' the public path when served in production',
      env: 'SHOPIFY_FLAG_BUILD_BASE',
    }),
    client: Flags.boolean({
      description: 'build the client code',
      env: 'SHOPIFY_FLAG_BUILD_CLIENT',
      allowNo: true,
      default: true,
    }),
    target: Flags.string({
      char: 't',
      description: 'the target platform to build for (worker or node)',
      options: ['node', 'worker'],
      default: 'worker',
      env: 'SHOPIFY_FLAG_BUILD_TARGET',
    }),
    entry: Flags.string({
      description: 'produce Server Side Rendering (SSR) build for node environments',
      env: 'SHOPIFY_FLAG_BUILD_SSR_ENTRY',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    const directory = flags.path ? resolvePath(flags.path) : cwd()

    const entry = flags.entry || PLATFORM_ENTRIES[flags.target as 'node' | 'worker']

    const targets = {
      client: flags.client,
      worker: flags.target === 'worker' ? entry : false,
      node: flags.target === 'node' ? entry : false,
    }

    await build({...flags, directory, targets})
  }
}
