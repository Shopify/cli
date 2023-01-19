import {hydrogenFlags} from '../../../flags.js'
import {addTailwind} from '../../../services/tailwind.js'
import {load as loadApp, HydrogenApp} from '../../../models/hydrogen.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class AddTailwind extends Command {
  static flags = {
    ...globalFlags,
    ...hydrogenFlags,
    force: Flags.boolean({
      hidden: false,
      char: 'f',
      description: 'overwrite existing configuration',
      default: false,
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  public async run(): Promise<void> {
    const {
      flags: {path: pathFlag, install, force},
    } = await this.parse(AddTailwind)
    const directory = pathFlag ? resolvePath(pathFlag) : process.cwd()

    const app: HydrogenApp = await loadApp(directory)

    await addTailwind({app, directory, install, force})
  }
}
