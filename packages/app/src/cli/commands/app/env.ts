import {appFlags} from '../../flags'
import {App, load as loadApp} from '../../models/app/app'
import {Command} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'
import env from '../../services/env'

export default class Env extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Env)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)

    await env({app})
  }
}
