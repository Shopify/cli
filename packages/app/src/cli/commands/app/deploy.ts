import {appFlags} from '../../flags'
import {Command, Flags} from '@oclif/core'
import {path, output, id, cli, file} from '@shopify/cli-kit'
import {App, load as loadApp} from '$cli/models/app/app'
import build from '$cli/services/build'
import {upload, generateUrl} from '$cli/services/upload'
import bundleService from '$cli/services/bundle'
import archiveService from '$cli/services/archive'

export default class Deploy extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    uploadUrl: Flags.string({
      hidden: true,
      description: 'Signed URL to upload the app.',
      env: 'SHOPIFY_FLAG_UPLOAD_URL',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Deploy)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const uploadUrlOverride = flags.uploadUrl
    const app: App = await loadApp(directory)
    output.info('Building your app...')
    output.newline()
    await build({app})

    output.newline()
    output.info('Pushing your code to Shopify...')
    // await new Promise((resolve, reject) => {
    //   setInterval(resolve, 3 * 1000)
    // })

    output.newline()
    output.success(`${app.configuration.name} deploy to Shopify Partners`)

    const appBundle = await bundleService(app)
    const outputZipPath = await archiveService(appBundle)
    // get signed gcs url here (or per extension below?)

    const deploymentUuid = id.generate()
    const url = await generateUrl(app.configuration.id, deploymentUuid, uploadUrlOverride)
    await upload(app.configuration.id, deploymentUuid, outputZipPath, url)

    // clean up
    file.rmdir(outputZipPath, {force: true})

    output.newline()
    output.info('Summary')
    app.extensions.forEach((extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${path.basename(
          extension.directory,
        )} is deployed to Shopify but not yet live`,
      )
      output.info(JSON.stringify(extension))
    })

    output.newline()
    output.info('Next steps')
    app.extensions.forEach((extension) => {
      output.info(`  · Publish ${path.basename(extension.directory)} from Shopify Partners:`)
      output.info(`   https://partners.shopify.com/....`)
    })
  }
}
