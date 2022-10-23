import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {Format, info} from '../../services/info.js'
import {load as loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {output, path, cli} from '@shopify/cli-kit'

export default class AppInfo extends Command {
  static description = 'Print basic information about your app and extensions'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    json: Flags.boolean({
      hidden: false,
      description: 'format output as JSON',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    'web-env': Flags.boolean({
      hidden: false,
      description: 'Outputs environment variables necessary for running and deploying web/.',
      env: 'SHOPIFY_FLAG_OUTPUT_WEB_ENV',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppInfo)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory, 'report')
    output.info(await info(app, {format: (flags.json ? 'json' : 'text') as Format, webEnv: flags['web-env']}))
    if (app.errors) process.exit(2)
  }
}
