import {appFlags} from '../../flags'
import {App, load as loadApp} from '../../models/app/app'
import {Command} from '@oclif/core'
import {path, cli, output} from '@shopify/cli-kit'

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

    output.newline()
    output.info(
      output.content`These are the environment variables the Shopify app will expect to receive:
- ${output.token.green('SHOPIFY_API_KEY')}: API key for your Shopify app
- ${output.token.green('SHOPIFY_API_SECRET')}: API secret for your Shopify app
- ${output.token.green(
        'SCOPES',
      )}: Comma-separated scopes required by your Shopify app (currently ${output.token.heading(
        app.configuration.scopes,
      )})
- ${output.token.green('HOST')}: Hostname of your app, do not add a scheme or trailing slashes
- ${output.token.green('BACKEND_PORT')} or ${output.token.green('PORT')}: Port on which your server will run
`,
    )
  }
}
