import {bundle} from './deploy/bundle'
import {upload} from './deploy/upload'

import {ensureDeployEnvironment} from './environment'
import {App, getUIExtensionRendererVersion, UIExtension} from '../models/app/app'
import {UIExtensionTypes} from '../constants'
import {loadLocalesConfig} from '../utilities/extensions/locales-configuration'
import {path, output, temporary, error} from '@shopify/cli-kit'

const WEB_PIXEL_CONFIG_ERROR = (property: string) => {
  return new error.Abort(
    `The web pixel extension configuration is missing the key "${property}"`,
    `Please update your shopify.ui.extension.toml to include a valid "${property}"`,
  )
}

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

  const extensions = await Promise.all(
    options.app.extensions.ui.map(async (extension) => {
      return {
        uuid: identifiers.extensions[extension.localIdentifier],
        config: JSON.stringify(await configFor(extension, app)),
        context: '',
      }
    }),
  )

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

async function configFor(extension: UIExtension, app: App) {
  const type = extension.type as UIExtensionTypes
  switch (extension.type as UIExtensionTypes) {
    case 'checkout_post_purchase':
      return {metafields: extension.configuration.metafields}
    case 'product_subscription':
      // eslint-disable-next-line @typescript-eslint/naming-convention
      return {renderer_version: getUIExtensionRendererVersion(type, app)}
    case 'checkout_ui_extension': {
      const localizationConfig = await loadLocalesConfig(extension.directory)
      return {localization: localizationConfig, ...extension.configuration}
    }
    case 'web_pixel_extension': {
      validateWebPixelConfig(extension)
      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        runtime_context: extension.configuration.runtimeContext,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        runtime_configuration_definition: extension.configuration.configuration,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        config_version: extension.configuration.version,
      }
    }
  }
}

function validateWebPixelConfig(extension: UIExtension) {
  if (!extension.configuration.runtimeContext) {
    throw WEB_PIXEL_CONFIG_ERROR('runtime_context')
  }

  if (!extension.configuration.configuration) {
    throw WEB_PIXEL_CONFIG_ERROR('configuration')
  }

  if (!extension.configuration.version) {
    throw WEB_PIXEL_CONFIG_ERROR('version')
  }
}
