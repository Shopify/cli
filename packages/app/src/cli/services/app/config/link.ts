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
import {APP_ACCESS_IDENTIFIER} from '../../../models/extensions/app-config.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

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
  // Get remote app configuration from app modules
  const remoteAppConfig = await getRemoteAppConfig(remoteApp.apiKey)
  const configuration = mergeAppConfiguration(
    {...localApp.configuration, path: configFilePath},
    {...remoteApp, ...remoteAppConfig},
  )

  await writeAppConfigurationFile(configuration)

  await saveCurrentConfig({configFileName, directory})

  if (shouldRenderSuccess) {
    renderSuccess({
      headline: `${configFileName} is now linked to "${remoteApp.title}" on Shopify`,
      body: `Using ${configFileName} as your default config.`,
      nextSteps: [
        [`Make updates to ${configFileName} in your local project`],
        [
          'To upload your config, run',
          {command: formatPackageManagerCommand(localApp.packageManager, 'shopify app config push')},
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

async function loadAppConfigFromDefaultToml(options: LinkOptions): Promise<AppInterface> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
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
  directory?: string,
): Promise<OrganizationApp> {
  const token = await ensureAuthenticatedPartners()
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, token, directory)
  }
  const app = await fetchAppDetailsFromApiKey(apiKey, token)
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
  remoteApp: OrganizationApp & Pick<CurrentAppConfiguration, 'access'>,
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
    access: remoteApp.access,
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

export async function getRemoteAppConfig(apiKey: string): Promise<Partial<CurrentAppConfiguration>> {
  const token = await ensureAuthenticatedPartners()
  const remoteSpecifications = await fetchAppExtensionRegistrations({token, apiKey})
  const appAccessModule = remoteSpecifications.app.extensionRegistrations.find((extension) => {
    return extension.type.toLowerCase() === APP_ACCESS_IDENTIFIER
  })
  const appConfig: Partial<CurrentAppConfiguration> = {}

  if (appAccessModule?.activeVersion?.config) {
    try {
      const appAccessConfig = JSON.parse(appAccessModule.activeVersion.config)
      appConfig.access = appAccessConfig.access
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // Ignore errors
    }
  }

  return appConfig
}
