import {hydrogenFlags} from '../../../flags.js'
import {addESLint} from '../../../services/eslint.js'
import {load as loadApp, HydrogenApp} from '../../../models/hydrogen.js'
import {Command, Flags} from '@oclif/core'
import {cli, path} from '@shopify/cli-kit'

export default class AddESLint extends Command {
  static flags = {
    ...cli.globalFlags,
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
    const directory = pathFlag ? path.resolve(pathFlag) : process.cwd()

    const app: HydrogenApp = await loadApp(directory)

    await addESLint({app, install, force})
  }
}
