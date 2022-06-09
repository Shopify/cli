import {appFlags} from '../../flags'
import {load as loadApp, App} from '../../models/app/app'
import {Format, info} from '../../services/info'
import {Command, Flags} from '@oclif/core'
import {output, path, cli} from '@shopify/cli-kit'

export default class AppInfo extends Command {
  static description = 'Print basic information about your app and extensions'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
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
    const {flags} = await this.parse(AppInfo)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory, 'report')
    output.info(await info(app, {format: flags.format as Format}))
    if (app.errors) process.exit(2)
  }
}
