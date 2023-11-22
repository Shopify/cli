import {saveCurrentConfig} from './use.js'
import {
  AppConfiguration,
  AppInterface,
  EmptyApp,
  getAppVersionedSchema,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp, OrganizationConfigurationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'

import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp, logMetadataForLoadedContext} from '../../context.js'
import {fetchAppDetailsFromApiKey, fetchAppExtensionRegistrations} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {fetchPartnersSession} from '../../context/partner-account-info.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {AllAppExtensionRegistrationsQuerySchema} from '../../../api/graphql/all_app_extension_registrations.js'
import {updateAppIdentifiers} from '../../../models/app/identifiers.js'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<AppConfiguration> {
  const localApp = await loadAppConfigFromDefaultToml(options)
  const directory = localApp?.directory || options.directory
  const remoteApp = await loadRemoteApp(localApp, options.apiKey, directory)
  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(options.directory, configFileName)
  // Fetch app_config extension registrations
  const partnersSession = await fetchPartnersSession()
  const remoteSpecifications = await fetchAppExtensionRegistrations({
    token: partnersSession.token,
    apiKey: remoteApp.apiKey,
  })
  let configuration: AppConfiguration
  let uploadCommand = 'config push'
  // linkAppVersionedConfig => new remote app or remote app with at least one app_config extension registrations
  if (localApp.configVersion === '3') {
    configuration = await linkAppVersionedConfig(
      localApp,
      remoteApp,
      options,
      configFilePath,
      configFileName,
      directory,
      remoteSpecifications,
    )
    uploadCommand = 'deploy'
  } else {
    configuration = await linkAppConfig(localApp, remoteApp, options, configFilePath, configFileName, directory)
  }
  if (shouldRenderSuccess) {
    renderSuccess({
      headline: `${configFileName} is now linked to "${remoteApp.title}" on Shopify`,
      body: `Using ${configFileName} as your default config.`,
      nextSteps: [
        [`Make updates to ${configFileName} in your local project`],
        [
          'To upload your config, run',
          {command: formatPackageManagerCommand(localApp.packageManager, `shopify app ${uploadCommand}`)},
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

  await logMetadataForLoadedContext(remoteApp)
  return configuration
}

async function linkAppVersionedConfig(
  localApp: AppInterface,
  remoteApp: OrganizationApp,
  options: LinkOptions,
  configFilePath: string,
  configFileName: string,
  directory: string,
  remoteSpecifications: AllAppExtensionRegistrationsQuerySchema,
) {
  // Populate the shopify.app.toml
  const {configSpecifications} = await loadLocalExtensionsSpecifications(options.commandConfig)
  let configSections: {[key: string]: unknown} = {}
  remoteSpecifications.app.configExtensionRegistrations.forEach((extension) => {
    const configSpec = configSpecifications.find((spec) => spec.identifier === extension.type.toLowerCase())
    if (!configSpec) return
    const firstLevelObjectName = Object.keys(configSpec.schema._def.shape())[0]!
    let configExtensionString = extension.activeVersion?.config
    let configExtension = configExtensionString ? JSON.parse(configExtensionString) : {}
    configSections[firstLevelObjectName] = configExtension
  })
  const configuration = {
    ...{...localApp.configuration, path: configFilePath},
    ...{
      version: '3',
      name: remoteApp.title,
      client_id: remoteApp.apiKey,
    },
    ...configSections,
  }
  const versionAppSchema = getAppVersionedSchema(configSpecifications)
  await writeAppConfigurationFile(configuration, versionAppSchema)
  // Cache the toml file content
  await saveCurrentConfig({configFileName, directory, configVersion: localApp.configVersion})
  return configuration
}

async function linkAppConfig(
  localApp: AppInterface,
  remoteApp: OrganizationApp,
  options: LinkOptions,
  configFilePath: string,
  configFileName: string,
  directory: string,
) {
  const configuration = mergeAppConfiguration(
    {...localApp.configuration, path: configFilePath},
    {
      ...remoteApp,
    },
  )
  await writeAppConfigurationFile(configuration)
  await saveCurrentConfig({configFileName, directory})
  return configuration
}

async function loadAppConfigFromDefaultToml(options: LinkOptions): Promise<AppInterface> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
    const app = await loadApp({
      ...specifications,
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
  directory?: string,
): Promise<OrganizationApp> {
  const partnersSession = await fetchPartnersSession()
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
  remoteApp: OrganizationConfigurationApp,
): AppConfiguration {
  const result: AppConfiguration = {
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
