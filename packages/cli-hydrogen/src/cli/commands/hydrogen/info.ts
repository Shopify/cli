import {Format, info} from '../../services/info'
import {load as loadApp, HydrogenApp} from '../../models/hydrogen'
import {hydrogenFlags} from '../../flags'
import {Command, Flags} from '@oclif/core'
import {output, path, cli} from '@shopify/cli-kit'

export default class Info extends Command {
  static description = 'Print basic information about your hydrogen app'

  static flags = {
    ...cli.globalFlags,
    ...hydrogenFlags,
    format: Flags.string({
      hidden: false,
      char: 'f',
      description: 'output format',
      options: ['json', 'text'],
      default: 'text',
      env: 'SHOPIFY_FLAG_FORMAT',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Info)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: HydrogenApp = await loadApp(directory, 'report')

    output.info(info(app, {format: flags.format as Format}))
    if (app.errors) process.exit(2)
  }
}
