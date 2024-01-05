import {saveCurrentConfig} from './use.js'
import {
  AppConfiguration,
  AppInterface,
  CurrentAppConfiguration,
  EmptyApp,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp, logMetadataForLoadedContext} from '../../context.js'
import {fetchAppDetailsFromApiKey, fetchAppExtensionRegistrations} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {PartnersSession, fetchPartnersSession} from '../../context/partner-account-info.js'
import {ExtensionRegistration} from '../../../api/graphql/all_app_extension_registrations.js'
import {ExtensionSpecification} from '../../../models/extensions/specification.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<AppConfiguration> {
  const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
  const localApp = await loadAppConfigFromDefaultToml(options, specifications)
  const directory = localApp?.directory || options.directory
  const partnersSession = await fetchPartnersSession()
  const remoteApp = await loadRemoteApp(localApp, options.apiKey, partnersSession, directory)

  await logMetadataForLoadedContext(remoteApp)

  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(directory, configFileName)

  const remoteExtensionRegistrations = await fetchAppExtensionRegistrations({
    token: partnersSession.token,
    apiKey: remoteApp.apiKey,
  })
  const remoteAppConfigurationExtension = remoteAppConfigurationExtensionContent(
    remoteExtensionRegistrations.app.configurationRegistrations,
    specifications,
  )
  const localAndRemoteApiClientConfiguration = mergeAppConfiguration(
    {...localApp.configuration, path: configFilePath},
    remoteApp,
  )
  const configuration = deepMergeObjects(localAndRemoteApiClientConfiguration, remoteAppConfigurationExtension)

  await writeAppConfigurationFile(configuration)

  await saveCurrentConfig({configFileName, directory})

  const usingVersionedAppConfig = remoteExtensionRegistrations.app.configurationRegistrations.length > 0
  if (shouldRenderSuccess) {
    renderSuccess({
      headline: `${configFileName} is now linked to "${remoteApp.title}" on Shopify`,
      body: `Using ${configFileName} as your default config.`,
      nextSteps: [
        [`Make updates to ${configFileName} in your local project`],
        [
          'To upload your config, run',
          {
            command: formatPackageManagerCommand(
              localApp.packageManager,
              `shopify app ${usingVersionedAppConfig ? 'deploy' : 'config push'}`,
            ),
          },
        ],
      ],
      reference: [
        {
          link: {
            label: 'App configuration',
            url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
          },
        },
      ],
    })
  }

  return configuration
}

async function loadAppConfigFromDefaultToml(
  options: LinkOptions,
  specifications: ExtensionSpecification[],
): Promise<AppInterface> {
  try {
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: configurationFileNames.app,
    })
    return app
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return new EmptyApp()
  }
}

async function loadRemoteApp(
  localApp: AppInterface,
  apiKey: string | undefined,
  partnersSession: PartnersSession,
  directory?: string,
): Promise<OrganizationApp> {
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, partnersSession, directory)
  }
  const app = await fetchAppDetailsFromApiKey(apiKey, partnersSession.token)
  if (!app) {
    const errorMessage = InvalidApiKeyErrorMessage(apiKey)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return app
}

async function loadConfigurationFileName(
  remoteApp: OrganizationApp,
  options: LinkOptions,
  localApp: AppInterface,
): Promise<string> {
  const cache = getCachedCommandInfo()

  if (!cache?.askConfigName && cache?.selectedToml) return cache.selectedToml as string

  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (!localApp.configuration || (localApp && isLegacyAppSchema(localApp.configuration))) {
    return configurationFileNames.app
  }

  const configName = await selectConfigName(localApp.directory || options.directory, remoteApp.title)
  return `shopify.app.${configName}.toml`
}

export function mergeAppConfiguration(
  appConfiguration: AppConfiguration,
  remoteApp: OrganizationApp,
): CurrentAppConfiguration {
  const result: CurrentAppConfiguration = {
    path: appConfiguration.path,
    client_id: remoteApp.apiKey,
    name: remoteApp.title,
    application_url: remoteApp.applicationUrl.replace(/\/$/, ''),
    embedded: remoteApp.embedded === undefined ? true : remoteApp.embedded,
    webhooks: {
      api_version: remoteApp.webhookApiVersion || '2023-07',
    },
    auth: {
      redirect_urls: remoteApp.redirectUrlWhitelist,
    },
    pos: {
      embedded: remoteApp.posEmbedded || false,
    },
  }

  const hasAnyPrivacyWebhook =
    remoteApp.gdprWebhooks?.customerDataRequestUrl ||
    remoteApp.gdprWebhooks?.customerDeletionUrl ||
    remoteApp.gdprWebhooks?.shopDeletionUrl

  if (hasAnyPrivacyWebhook) {
    result.webhooks.privacy_compliance = {
      customer_data_request_url: remoteApp.gdprWebhooks?.customerDataRequestUrl,
      customer_deletion_url: remoteApp.gdprWebhooks?.customerDeletionUrl,
      shop_deletion_url: remoteApp.gdprWebhooks?.shopDeletionUrl,
    }
  }

  if (remoteApp.appProxy?.url) {
    result.app_proxy = {
      url: remoteApp.appProxy.url,
      subpath: remoteApp.appProxy.subPath,
      prefix: remoteApp.appProxy.subPathPrefix,
    }
  }

  if (remoteApp.preferencesUrl) {
    result.app_preferences = {url: remoteApp.preferencesUrl}
  }

  result.access_scopes = getAccessScopes(appConfiguration, remoteApp)

  if (appConfiguration.extension_directories) {
    result.extension_directories = appConfiguration.extension_directories
  }

  if (appConfiguration.web_directories) {
    result.web_directories = appConfiguration.web_directories
  }

  return result
}

const getAccessScopes = (appConfiguration: AppConfiguration, remoteApp: OrganizationApp) => {
  // if we have upstream scopes, use them
  if (remoteApp.requestedAccessScopes) {
    return {
      scopes: remoteApp.requestedAccessScopes.join(','),
    }
    // if we have scopes locally and not upstream, preserve them but don't push them upstream (legacy is true)
  } else if (isLegacyAppSchema(appConfiguration) && appConfiguration.scopes) {
    return {
      scopes: appConfiguration.scopes,
      use_legacy_install_flow: true,
    }
  } else if (isCurrentAppSchema(appConfiguration) && appConfiguration.access_scopes?.scopes) {
    return {
      scopes: appConfiguration.access_scopes.scopes,
      use_legacy_install_flow: true,
    }
    // if we can't find scopes or have to fall back, omit setting a scope and set legacy to true
  } else {
    return {
      use_legacy_install_flow: true,
    }
  }
}

export function remoteAppConfigurationExtensionContent(
  configRegistrations: ExtensionRegistration[],
  specifications: ExtensionSpecification[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter((spec) => spec.appModuleFeatures().includes('app_config'))
  configRegistrations.forEach((extension) => {
    const configSpec = configSpecifications.find((spec) => spec.identifier === extension.type.toLowerCase())
    if (!configSpec) return
    const configExtensionString = extension.activeVersion?.config
    if (!configExtensionString) return
    const configExtension = configExtensionString ? JSON.parse(configExtensionString) : {}

    remoteAppConfig = {...remoteAppConfig, ...(configSpec.reverseTransform?.(configExtension) ?? configExtension)}
  })
  return {...remoteAppConfig}
}
