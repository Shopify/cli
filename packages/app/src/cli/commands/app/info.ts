import {appFlags} from '../../flags'
import {Command} from '@oclif/core'
import {output, path, cli} from '@shopify/cli-kit'
import {load as loadApp, App} from '$cli/models/app/app'

export default class AppInfo extends Command {
  static description = 'Print basic information about your app and blocks'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppInfo)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory, 'report')
    output.info(output.content`${JSON.stringify(app, null, 2)}`)
    if (app.errors) process.exit(2)
  }
}
