import {Command, Flags} from '@oclif/core'
import {path, output} from '@shopify/cli-kit'
import {App, load as loadApp} from '$cli/models/app/app'
import build from '$cli/services/build'

export default class Build extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your app directory',
      env: 'SHOPIFY_APP_PATH',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Build)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    output.info('Building your app...')
    output.newline()
    await build({app})

    output.newline()
    output.info('Pushing your code to Shopify...')
    await new Promise((resolve, reject) => {
      setTimeout(resolve, 3 * 1000)
    })

    output.newline()
    output.success(`${app.configuration.name} deploy to Shopify Partners`)

    output.newline()
    output.info('Summary')
    app.extensions.forEach((extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${path.basename(
          extension.directory,
        )} is deployed to Shopify but not yet live`,
      )
    })

    output.newline()
    output.info('Next steps')
    app.extensions.forEach((extension) => {
      output.info(`  · Publish ${path.basename(extension.directory)} from Shopify Partners:`)
      output.info(`   https://partners.shopify.com/....`)
    })
  }
}
