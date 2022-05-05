import build from './build'
import {bundle} from './bundle'
import {archive} from './archive'
import {upload} from './upload'
import {App} from '../models/app/app'
import {path, output, temporary} from '@shopify/cli-kit'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
  /**
   * Overrides the URL the app is uploaed to.
   */
  uploadUrlOverride: string | undefined
}

export const deploy = async ({app, uploadUrlOverride}: DeployOptions) => {
  output.info('Building your app...')
  output.newline()
  await build({app})

  output.newline()
  output.info('Pushing your code to Shopify...')

  output.newline()
  output.success(`${app.configuration.name} deploy to Shopify Partners`)

  await temporary.directory(async (tmpDir) => {
    const zipPath = path.join(tmpDir, `${app.configuration.name}.zip`)
    const appBundle = await bundle(app)
    await archive(appBundle, zipPath)
    // get signed gcs url here (or per extension below?)

    await upload({
      app,
      archivePath: zipPath,
      signedURL: uploadUrlOverride,
    })

    output.newline()
    output.info('Summary')
    app.extensions.ui.forEach((extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${path.basename(
          extension.directory,
        )} is deployed to Shopify but not yet live`,
      )
    })

    output.newline()
    output.info('Next steps')
    app.extensions.ui.forEach((extension) => {
      output.info(`  · Publish ${path.basename(extension.directory)} from Shopify Partners:`)
      output.info(`   https://partners.shopify.com/....`)
    })
  })
}
