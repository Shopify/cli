import {hydrogenFlags} from '../../../flags.js'
import {addESLint} from '../../../services/eslint.js'
import {load as loadApp, HydrogenApp} from '../../../models/hydrogen.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class AddESLint extends Command {
  static flags = {
    ...globalFlags,
    ...hydrogenFlags,
    force: Flags.boolean({
      hidden: false,
      char: 'f',
      description: 'Overwrite existing configuration',
      default: false,
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  public async run(): Promise<void> {
    const {
      flags: {path: pathFlag, install, force},
    } = await this.parse(AddESLint)
    const directory = pathFlag ? resolvePath(pathFlag) : cwd()

    const app: HydrogenApp = await loadApp(directory)

    await addESLint({app, install, force})
  }
}
