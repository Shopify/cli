/* eslint-disable require-atomic-updates */
import {bundleUIAndBuildFunctionExtensions} from './deploy/bundle.js'
import {
  uploadThemeExtensions,
  uploadFunctionExtensions,
  uploadUIExtensionsBundle,
  UploadExtensionValidationError,
} from './deploy/upload.js'

import {ensureDeployEnvironment} from './environment.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {AppInterface, getUIExtensionRendererVersion} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers} from '../models/app/identifiers.js'
import {Extension, UIExtension} from '../models/app/extensions.js'
import {isFunctionExtensionType, isThemeExtensionType, isUiExtensionType, UIExtensionTypes} from '../constants.js'
import {loadLocalesConfig} from '../utilities/extensions/locales-configuration.js'
import {validateExtensions} from '../validators/extensions.js'
import {OrganizationApp} from '../models/organization.js'
import {path, output, file, error, environment} from '@shopify/cli-kit'
import {AllAppExtensionRegistrationsQuerySchema} from '@shopify/cli-kit/src/api/graphql'

const RendererNotFoundBug = (extension: string) => {
  return new error.Bug(
    `Couldn't find renderer version for extension ${extension}`,
    'Make sure you have all your dependencies up to date',
  )
}

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** If true, ignore any cached appId or extensionId */
  reset: boolean
}

export const deploy = async (options: DeployOptions) => {
  if (!options.app.hasExtensions()) {
    output.newline()
    output.info(`No extensions to deploy to Shopify Partners yet.`)
    return
  }

  // eslint-disable-next-line prefer-const
  let {app, identifiers, partnersApp, partnersOrganizationId, token} = await ensureDeployEnvironment(options)
  const apiKey = identifiers.app

  output.newline()
  output.info(`Deploying your work to Shopify Partners. It will be part of ${partnersApp.title}`)
  output.newline()

  const extensions = await Promise.all(
    options.app.extensions.ui.map(async (extension) => {
      return {
        uuid: identifiers.extensions[extension.localIdentifier],
        config: JSON.stringify(await configFor(extension, app)),
        context: '',
      }
    }),
  )

  await file.inTemporaryDirectory(async (tmpDir) => {
    try {
      const bundlePath = path.join(tmpDir, `bundle.zip`)
      await file.mkdir(path.dirname(bundlePath))
      const bundle = app.extensions.ui.length !== 0
      await bundleUIAndBuildFunctionExtensions({app, bundlePath, identifiers, bundle})

      output.newline()
      output.info(`Running validation…`)

      await validateExtensions(app)

      output.newline()
      output.info(`Pushing your code to Shopify…`)
      output.newline()

      let validationErrors: UploadExtensionValidationError[] = []
      if (bundle) {
        /**
         * The bundles only support UI extensions for now so we only need bundle and upload
         * the bundle if the app has UI extensions.
         */
        validationErrors = await uploadUIExtensionsBundle({apiKey, bundlePath, extensions, token})
      }

      await uploadThemeExtensions(options.app.extensions.theme, {apiKey, identifiers, token})
      identifiers = await uploadFunctionExtensions(app.extensions.function, {identifiers, token})
      app = await updateAppIdentifiers({app, identifiers, command: 'deploy'})

      if (validationErrors.length > 0) {
        output.completed('Deployed to Shopify, but fixes are needed')
      } else {
        output.success('Deployed to Shopify')
      }

      const registrations = await fetchAppExtensionRegistrations({token, apiKey: identifiers.app})

      outputCompletionMessage({app, partnersApp, partnersOrganizationId, identifiers, registrations, validationErrors})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      /**
       * If deployment fails when uploading we want the identifiers to be persisted
       * for the next run.
       */
      await updateAppIdentifiers({app, identifiers, command: 'deploy'})
      throw error
    }
  })
}

async function outputCompletionMessage({
  app,
  partnersApp,
  partnersOrganizationId,
  identifiers,
  registrations,
  validationErrors,
}: {
  app: AppInterface
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  partnersOrganizationId: string
  identifiers: Identifiers
  registrations: AllAppExtensionRegistrationsQuerySchema
  validationErrors: UploadExtensionValidationError[]
}) {
  output.newline()
  output.info('  Summary:')
  const outputDeployedButNotLiveMessage = (extension: Extension) => {
    output.info(output.content`    • ${extension.localIdentifier} is deployed to Shopify but not yet live`)
    const uuid = identifiers.extensions[extension.localIdentifier]
    const validationError = validationErrors.find((error) => error.uuid === uuid)

    if (validationError) {
      const title = output.token.errorText('Validation errors found in your extension toml file')
      output.info(output.content`       - ${title} `)
      validationError.errors.forEach((err) => {
        output.info(output.content`       └ ${output.token.italic(err.message)}`)
      })
    }
  }
  const outputDeployedAndLivedMessage = (extension: Extension) => {
    output.info(output.content`    · ${extension.localIdentifier} is live`)
  }
  app.extensions.ui.forEach(outputDeployedButNotLiveMessage)
  app.extensions.theme.forEach(outputDeployedButNotLiveMessage)
  app.extensions.function.forEach(outputDeployedAndLivedMessage)

  output.newline()
  const outputNextStep = async (extension: Extension) => {
    const extensionId =
      registrations.app.extensionRegistrations.find((registration) => {
        return registration.uuid === identifiers.extensions[extension.localIdentifier]
      })?.id ?? ''
    return output.content`    · Publish ${output.token.link(
      extension.localIdentifier,
      await getExtensionPublishURL({extension, partnersApp, partnersOrganizationId, extensionId}),
    )}`
  }
  if (app.extensions.ui.length !== 0 || app.extensions.function.length !== 0) {
    const lines = await Promise.all([...app.extensions.ui, ...app.extensions.theme].map(outputNextStep))
    if (lines.length > 0) {
      output.info('  Next steps in Shopify Partners:')
      lines.forEach(output.info)
    }
  }
}

async function configFor(extension: UIExtension, app: AppInterface) {
  const type = extension.type as UIExtensionTypes
  switch (extension.type as UIExtensionTypes) {
    case 'checkout_post_purchase':
      return {metafields: extension.configuration.metafields}
    case 'pos_ui_extension':
    case 'product_subscription': {
      const result = await getUIExtensionRendererVersion(type, app)
      if (result === 'not_found') throw RendererNotFoundBug(type)
      // eslint-disable-next-line @typescript-eslint/naming-convention
      return {renderer_version: result?.version}
    }
    case 'checkout_ui_extension': {
      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        extension_points: extension.configuration.extensionPoints,
        capabilities: extension.configuration.capabilities,
        metafields: extension.configuration.metafields,
        name: extension.configuration.name,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        configuration_schema: extension.configuration.configurationSchema,
        localization: await loadLocalesConfig(extension.directory),
      }
    }
    case 'web_pixel_extension': {
      return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        runtime_context: extension.configuration.runtimeContext,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        runtime_configuration_definition: extension.configuration.configuration,
      }
    }
  }
}

async function getExtensionPublishURL({
  extension,
  partnersApp,
  partnersOrganizationId,
  extensionId,
}: {
  extension: Extension
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  partnersOrganizationId: string
  extensionId: string
}): Promise<string> {
  const partnersFqdn = await environment.fqdn.partners()
  if (isUiExtensionType(extension.type)) {
    /**
     * The source of truth for UI extensions' slugs is the client-side
     * Partners' React application:
     * https://github.com/Shopify/partners/tree/master/app/assets/javascripts/sections/apps/app-extensions/extensions
     */
    let pathComponent: string
    switch (extension.type as UIExtensionTypes) {
      case 'checkout_ui_extension':
      case 'pos_ui_extension':
      case 'product_subscription':
        pathComponent = extension.type
        break
      case 'checkout_post_purchase':
        pathComponent = 'post_purchase'
        break
      case 'web_pixel_extension':
        pathComponent = 'web_pixel'
        break
    }
    return `https://${partnersFqdn}/${partnersOrganizationId}/apps/${partnersApp.id}/extensions/${pathComponent}/${extensionId}`
  } else if (isFunctionExtensionType(extension.type)) {
    return `https://${partnersFqdn}/${partnersOrganizationId}/apps/${partnersApp.id}/extensions`
  } else if (isThemeExtensionType(extension.type)) {
    return `https://${partnersFqdn}/${partnersOrganizationId}/apps/${partnersApp.id}/extensions/theme_app_extension/${extensionId}`
  } else {
    return ''
  }
}
