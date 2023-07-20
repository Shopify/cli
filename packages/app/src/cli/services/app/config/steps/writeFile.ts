/* eslint-disable @typescript-eslint/no-explicit-any */

import {AppConfiguration, AppInterface, isCurrentAppSchema, isLegacyAppSchema} from '../../../../models/app/app.js'
import {OrganizationApp} from '../../../../models/organization.js'
import {saveCurrentConfig} from '../use.js'
import {createStep, transition} from '../utils/utils.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {writeFileSync} from '@shopify/cli-kit/node/fs'

interface SaveCurrentConfigOptions {
  configFileName: string
  directory: string
}

export default createStep('writeFile', writeFile)

async function writeFile(options: any) {
  const configuration = mergeAppConfiguration(options.localApp, options.remoteApp)

  writeFileSync(options.configFilePath, encodeToml(configuration))

  const opts = {configFileName: options.configFileName, directory: options.directory} as SaveCurrentConfigOptions

  await saveCurrentConfig(opts)

  await transition({step: 'success', options})
}

export function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const configuration: AppConfiguration = {
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
    configuration.webhooks.privacy_compliance = {
      customer_data_request_url: remoteApp.gdprWebhooks?.customerDataRequestUrl,
      customer_deletion_url: remoteApp.gdprWebhooks?.customerDeletionUrl,
      shop_deletion_url: remoteApp.gdprWebhooks?.shopDeletionUrl,
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

  if (isCurrentAppSchema(localApp.configuration) && localApp.configuration?.build) {
    configuration.build = localApp.configuration.build
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
