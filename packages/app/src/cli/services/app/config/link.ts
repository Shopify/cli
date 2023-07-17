import {saveCurrentConfig} from './use.js'
import {AppConfiguration, AppInterface, isCurrentAppSchema, isLegacyAppSchema} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExists, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions): Promise<void> {
  const localApp = await loadAppConfigFromDefaultToml(options)
  const remoteApp = await loadRemoteApp(localApp, options.apiKey)
  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(options.directory, configFileName)
  const fileAlreadyExists = await fileExists(configFilePath)

  const configuration = mergeAppConfiguration(localApp, remoteApp)

  writeFileSync(configFilePath, encodeToml(configuration))

  await saveCurrentConfig({configFileName, directory: options.directory})

  renderSuccess({
    headline: `App "${remoteApp.title}" connected to this codebase, file ${configFileName} ${
      fileAlreadyExists ? 'updated' : 'created'
    }`,
  })
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
    return {configuration: {scopes: ''}} as AppInterface
  }
}

async function loadRemoteApp(localApp: AppInterface, apiKey: string | undefined): Promise<OrganizationApp> {
  const token = await ensureAuthenticatedPartners()
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, token)
  }
  const app = await fetchAppFromApiKey(apiKey, token)
  if (!app) {
    const errorMessage = InvalidApiKeyErrorMessage(apiKey)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return app
}

async function loadConfigurationFileName(
  remoteApp: OrganizationApp,
  options: LinkOptions,
  localApp?: AppInterface,
): Promise<string> {
  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (!localApp?.configuration || (localApp && isLegacyAppSchema(localApp.configuration))) {
    return configurationFileNames.app
  }

  const configName = await selectConfigName(options.directory, remoteApp.title)
  return `shopify.app.${configName}.toml`
}

function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const configuration: AppConfiguration = {
    client_id: remoteApp.apiKey,
    name: remoteApp.title,
    api_contact_email: remoteApp.contactEmail!,
    application_url: remoteApp.applicationUrl,
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
    configuration.webhooks.privacy_compliance = {
      customer_data_request_url: remoteApp.gdprWebhooks?.customerDataRequestUrl || '',
      customer_deletion_url: remoteApp.gdprWebhooks?.customerDeletionUrl || '',
      shop_deletion_url: remoteApp.gdprWebhooks?.shopDeletionUrl || '',
    }
  }

  if (remoteApp.appProxy?.url) {
    configuration.app_proxy = {
      url: remoteApp.appProxy.url,
      subpath: remoteApp.appProxy.subPath,
      prefix: remoteApp.appProxy.subPathPrefix,
    }
  }

  if (remoteApp.preferencesUrl) {
    configuration.app_preferences = {url: remoteApp.preferencesUrl}
  }

  configuration.access_scopes = getAccessScopes(localApp, remoteApp)

  if (localApp.configuration?.extension_directories) {
    configuration.extension_directories = localApp.configuration.extension_directories
  }

  if (localApp.configuration?.web_directories) {
    configuration.web_directories = localApp.configuration.web_directories
  }

  return configuration
}

const getAccessScopes = (localApp: AppInterface, remoteApp: OrganizationApp) => {
  // if we have upstream scopes, use them
  if (remoteApp.requestedAccessScopes) {
    return {
      scopes: remoteApp.requestedAccessScopes.join(','),
    }
    // if we have scopes locally and not upstream, preserve them but don't push them upstream (legacy is true)
  } else if (isLegacyAppSchema(localApp.configuration) && localApp.configuration.scopes) {
    return {
      scopes: localApp.configuration.scopes,
      use_legacy_install_flow: true,
    }
  } else if (isCurrentAppSchema(localApp.configuration) && localApp.configuration.access_scopes?.scopes) {
    return {
      scopes: localApp.configuration.access_scopes.scopes,
      use_legacy_install_flow: true,
    }
    // if we can't find scopes or have to fall back, omit setting a scope and set legacy to true
  } else {
    return {
      use_legacy_install_flow: true,
    }
  }
}
