import {bundle} from './deploy/bundle'
import {upload} from './deploy/upload'

import {App, getIdentifiers} from '../models/app/app'
import {path, output, temporary} from '@shopify/cli-kit'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
}

export const deploy = async ({app}: DeployOptions) => {
  const identifiers = await getIdentifiers({app, environmentType: 'production'})

  /**
   * TODO: We need some logic here to ensure we have IDs for the apps and all the
   * extensions that are part of it.
   */
  const apiKey = identifiers?.app as string

  output.newline()
  output.info('Pushing your code to Shopify...')

  output.newline()
  output.success(`${app.configuration.name} deploy to Shopify Partners`)

  await temporary.directory(async (tmpDir) => {
    const bundlePath = path.join(tmpDir, `${app.configuration.name}.zip`)
    await bundle({app, bundlePath})
    await upload({apiKey, bundlePath})

    output.newline()
    output.info('Summary')
    app.extensions.ui.forEach((extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${path.basename(
          extension.directory,
        )} is deployed to Shopify but not yet live`,
      )
    })
  })
}
