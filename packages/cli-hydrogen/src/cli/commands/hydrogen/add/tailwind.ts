import {hydrogenFlags} from '../../../flags.js'
import {addTailwind} from '../../../services/tailwind.js'
import {load as loadApp, HydrogenApp} from '../../../models/hydrogen.js'
import {Command, Flags} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'

export default class AddTailwind extends Command {
  static flags = {
    ...cli.globalFlags,
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
    const directory = pathFlag ? path.resolve(pathFlag) : process.cwd()

    const app: HydrogenApp = await loadApp(directory)

    await addTailwind({app, directory, install, force})
  }
}
