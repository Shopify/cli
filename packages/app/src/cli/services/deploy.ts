/* eslint-disable require-atomic-updates */
import {bundleUIAndBuildFunctionExtensions} from './deploy/bundle'
import {uploadFunctionExtensions, uploadUIExtensionsBundle} from './deploy/upload'

import {ensureDeployEnvironment} from './environment'
import {App, Extension, getUIExtensionRendererVersion, UIExtension, updateAppIdentifiers} from '../models/app/app'
import {UIExtensionTypes} from '../constants'
import {loadLocalesConfig} from '../utilities/extensions/locales-configuration'
import {validateExtensions} from '../validators/extensions'
import {path, output, temporary, file} from '@shopify/cli-kit'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App

  /** If true, ignore any cached appId or extensionId */
  reset: boolean
}

export const deploy = async (options: DeployOptions) => {
  // eslint-disable-next-line prefer-const
  let {app, identifiers, token} = await ensureDeployEnvironment(options)
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
    const bundlePath = path.join(tmpDir, `bundle.zip`)
    await file.mkdir(path.dirname(bundlePath))
    const bundle = app.extensions.ui.length !== 0
    await bundleUIAndBuildFunctionExtensions({app, bundlePath, identifiers, bundle})
    await validateExtensions(app)

    if (bundle) {
      /**
       * The bundles only support UI extensions for now so we only need bundle and upload
       * the bundle if the app has UI extensions.
       */
      await uploadUIExtensionsBundle({apiKey, bundlePath, extensions, token})
    }
    identifiers = await uploadFunctionExtensions(app.extensions.function, {identifiers, token})
    app = await updateAppIdentifiers({app, identifiers, environmentType: 'production'})
    outputCompletionMessage(app)
  })
}

function outputCompletionMessage(app: App) {
  output.newline()
  output.info('Summary')
  const outputDeployedButNotLiveMessage = (extension: Extension) => {
    output.info(
      output.content`${output.token.magenta('✔')} ${extension.localIdentifier} is deployed to Shopify but not yet live`,
    )
  }
  const outputDeployedAndLivedMessage = (extension: Extension) => {
    output.info(output.content`${output.token.magenta('✔')} ${extension.localIdentifier} is live`)
  }
  app.extensions.ui.forEach(outputDeployedButNotLiveMessage)
  app.extensions.theme.forEach(outputDeployedButNotLiveMessage)
  app.extensions.function.forEach(outputDeployedAndLivedMessage)
}

async function configFor(extension: UIExtension, app: App) {
  const type = extension.type as UIExtensionTypes
  switch (extension.type as UIExtensionTypes) {
    case 'checkout_post_purchase':
      return {metafields: extension.configuration.metafields}
    case 'pos_ui_extension':
    case 'product_subscription':
      // eslint-disable-next-line @typescript-eslint/naming-convention
      return {renderer_version: getUIExtensionRendererVersion(type, app)?.version}
    case 'checkout_ui_extension': {
      const localizationConfig = await loadLocalesConfig(extension.directory)
      return {localization: localizationConfig, ...extension.configuration}
    }
    case 'web_pixel_extension': {
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
