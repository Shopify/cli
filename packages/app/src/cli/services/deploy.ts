import {bundleUIAndBuildFunctionExtensions} from './deploy/bundle'
import {uploadFunctionExtensions, uploadUIExtensionsBundle} from './deploy/upload'

import {ensureDeployEnvironment} from './environment'
import {App, Extension, getUIExtensionRendererVersion, UIExtension, updateAppIdentifiers} from '../models/app/app'
import {UIExtensionTypes} from '../constants'
import {loadLocalesConfig} from '../utilities/extensions/locales-configuration'
import {path, output, temporary, error} from '@shopify/cli-kit'

const WebPixelConfigError = (property: string) => {
  return new error.Abort(
    `The Web Pixel Extension configuration is missing the key "${property}"`,
    `Please update your shopify.ui.extension.toml to include a valid "${property}"`,
  )
}

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
}

export const deploy = async (options: DeployOptions) => {
  // eslint-disable-next-line prefer-const
  let {app, identifiers, token} = await ensureDeployEnvironment({app: options.app})
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
    await bundleUIAndBuildFunctionExtensions({app, bundlePath, identifiers})
    await uploadUIExtensionsBundle({apiKey, bundlePath, extensions, token})
    // eslint-disable-next-line require-atomic-updates
    identifiers = await uploadFunctionExtensions(app.extensions.function, {identifiers, token})
    // eslint-disable-next-line require-atomic-updates
    app = await updateAppIdentifiers({app, identifiers, environmentType: 'production'})

    output.newline()
    output.info('Summary')
    const outputDeployedButNotLiveMessage = (extension: Extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${
          extension.localIdentifier
        } is deployed to Shopify but not yet live`,
      )
    }
    const outputDeployedAndLivedMessage = (extension: Extension) => {
      output.info(output.content`${output.token.magenta('✔')} ${extension.localIdentifier} is live`)
    }
    app.extensions.ui.forEach(outputDeployedButNotLiveMessage)
    app.extensions.theme.forEach(outputDeployedButNotLiveMessage)
    app.extensions.function.forEach(outputDeployedButNotLiveMessage)
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
    throw WebPixelConfigError('runtime_context')
  }

  if (!extension.configuration.configuration) {
    throw WebPixelConfigError('configuration')
  }

  if (!extension.configuration.version) {
    throw WebPixelConfigError('version')
  }
}
