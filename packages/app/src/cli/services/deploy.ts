import {bundle} from './deploy/bundle'
import {upload} from './deploy/upload'

import {ensureDeployEnvironment} from './environment'
import {App, getUIExtensionRendererVersion, UIExtension} from '../models/app/app'
import {path, output, temporary} from '@shopify/cli-kit'
import {UIExtensionTypes} from 'cli/constants'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
}

export const deploy = async (options: DeployOptions) => {
  const {app, identifiers} = await ensureDeployEnvironment({app: options.app})
  const apiKey = identifiers.app

  output.newline()
  output.info('Pushing your code to Shopify...')

  output.newline()
  output.success(`${app.name} deployed to Shopify Partners`)

  const extensions = options.app.extensions.ui.map((extension) => {
    return {
      uuid: identifiers.extensions[extension.localIdentifier],
      config: JSON.stringify(configFor(extension, app)),
      context: '',
    }
  })

  await temporary.directory(async (tmpDir) => {
    const bundlePath = path.join(tmpDir, `${app.name}.zip`)
    await bundle({app, bundlePath, identifiers})
    await upload({apiKey, bundlePath, extensions})

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

function configFor(extension: UIExtension, app: App) {
  const type = extension.type as UIExtensionTypes
  switch (extension.type as UIExtensionTypes) {
    case 'checkout_post_purchase':
      return {metafields: extension.configuration.metafields}
    case 'product_subscription':
      // eslint-disable-next-line @typescript-eslint/naming-convention
      return {renderer_version: getUIExtensionRendererVersion(type, app)}
    case 'checkout_ui_extension':
      // PENDING: Missing locales config
      // eslint-disable-next-line @typescript-eslint/naming-convention
      return {localization: {default_locale: 'en', translations: {}}, ...extension.configuration}
    case 'beacon_extension':
      // PENDING: what's needed for a beacon_extension??
      return {}
  }
}
