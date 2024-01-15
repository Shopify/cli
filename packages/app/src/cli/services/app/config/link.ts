import {saveCurrentConfig} from './use.js'
import {
  AppConfiguration,
  AppInterface,
  CurrentAppConfiguration,
  EmptyApp,
  getAppScopes,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp, logMetadataForLoadedContext} from '../../context.js'
import {fetchAppDetailsFromApiKey, fetchAppExtensionRegistrations} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {PartnersSession, fetchPartnersSession} from '../../context/partner-account-info.js'
import {ExtensionRegistration} from '../../../api/graphql/all_app_extension_registrations.js'
import {ExtensionSpecification} from '../../../models/extensions/specification.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {loadFSExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {deepMergeObjects, isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<AppConfiguration> {
  const {token, remoteApp, directory} = await selectRemoteApp(options)
  const {localApp, configFileName, configFilePath} = await loadLocalApp(options, token, remoteApp, directory)

  await logMetadataForLoadedContext(remoteApp)

  const remoteAppConfigurationFromApiClient = mergeAppConfiguration(
    {...localApp.configuration, path: configFilePath},
    remoteApp,
  )
  const remoteAppConfigurationFromExtensions = await loadRemoteAppConfigurationFromExtensions(
    token,
    remoteApp,
    localApp,
  )
  const configuration = deepMergeObjects(remoteAppConfigurationFromApiClient, remoteAppConfigurationFromExtensions)

  await writeAppConfigurationFile(configuration, localApp.configSchema)
  await saveCurrentConfig({configFileName, directory})

  if (shouldRenderSuccess) {
    renderSuccessMessage(configFileName, remoteApp, localApp, !isEmpty(remoteAppConfigurationFromExtensions))
  }

  return configuration
}

async function selectRemoteApp(options: LinkOptions) {
  const localApp = await loadAppConfigFromCurrentToml(options)
  const directory = localApp?.directory || options.directory
  const partnersSession = await fetchPartnersSession()
  const remoteApp = await loadRemoteApp(localApp, options.apiKey, partnersSession, directory)
  return {
    token: partnersSession.token,
    remoteApp,
    directory,
  }
}

async function loadLocalApp(options: LinkOptions, token: string, remoteApp: OrganizationApp, directory: string) {
  const specifications = await fetchSpecifications({
    token,
    apiKey: remoteApp.apiKey,
    config: options.commandConfig,
  })

  const localApp = await loadAppConfigFromCurrentToml(options, specifications)
  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(directory, configFileName)
  return {
    localApp,
    configFileName,
    configFilePath,
  }
}

async function loadAppConfigFromCurrentToml(
  options: LinkOptions,
  specifications?: ExtensionSpecification[],
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
    return new EmptyApp(await loadFSExtensionsSpecifications())
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

async function loadRemoteAppConfigurationFromExtensions(
  token: string,
  remoteApp: OrganizationApp,
  localApp: AppInterface,
) {
  const remoteExtensionRegistrations = await fetchAppExtensionRegistrations({
    token,
    apiKey: remoteApp.apiKey,
  })
  return remoteAppConfigurationExtensionContent(
    remoteExtensionRegistrations.app.configurationRegistrations,
    localApp.specifications ?? [],
  )
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
  return {
    ...addLocalAppConfig(appConfiguration, remoteApp),
    client_id: remoteApp.apiKey,
    name: remoteApp.title,
    application_url: remoteApp.applicationUrl.replace(/\/$/, ''),
    embedded: remoteApp.embedded === undefined ? true : remoteApp.embedded,
    auth: {
      redirect_urls: remoteApp.redirectUrlWhitelist,
    },
    pos: {
      embedded: remoteApp.posEmbedded || false,
    },
    ...addRemoteAppWebhooksConfig(remoteApp),
    ...addRemoteAppAccessScopesConfig(appConfiguration, remoteApp),
    ...addRemoteAppProxyConfig(remoteApp),
    ...addRemoteAppPreferencesConfig(remoteApp),
  }
}

function addRemoteAppPreferencesConfig(remoteApp: OrganizationApp) {
  return remoteApp.preferencesUrl
    ? {
        app_preferences: {
          url: remoteApp.preferencesUrl,
        },
      }
    : {}
}

function addRemoteAppProxyConfig(remoteApp: OrganizationApp) {
  return remoteApp.appProxy?.url
    ? {
        app_proxy: {
          url: remoteApp.appProxy.url,
          subpath: remoteApp.appProxy.subPath,
          prefix: remoteApp.appProxy.subPathPrefix,
        },
      }
    : {}
}

function addRemoteAppWebhooksConfig(remoteApp: OrganizationApp) {
  const hasAnyPrivacyWebhook =
    remoteApp.gdprWebhooks?.customerDataRequestUrl ||
    remoteApp.gdprWebhooks?.customerDeletionUrl ||
    remoteApp.gdprWebhooks?.shopDeletionUrl

  const privacyComplianceContent = {
    privacy_compliance: {
      customer_data_request_url: remoteApp.gdprWebhooks?.customerDataRequestUrl,
      customer_deletion_url: remoteApp.gdprWebhooks?.customerDeletionUrl,
      shop_deletion_url: remoteApp.gdprWebhooks?.shopDeletionUrl,
    },
  }

  return {
    webhooks: {
      api_version: remoteApp.webhookApiVersion || '2023-07',
      ...(hasAnyPrivacyWebhook ? privacyComplianceContent : {}),
    },
  }
}

function addRemoteAppAccessScopesConfig(appConfiguration: AppConfiguration, remoteApp: OrganizationApp) {
  let accessScopesContent = {}
  // if we have upstream scopes, use them
  if (remoteApp.requestedAccessScopes) {
    accessScopesContent = {
      scopes: remoteApp.requestedAccessScopes.join(','),
    }
    // if we can't find scopes or have to fall back, omit setting a scope and set legacy to true
  } else if (getAppScopes(appConfiguration) === '') {
    accessScopesContent = {
      use_legacy_install_flow: true,
    }
    // if we have scopes locally and not upstream, preserve them but don't push them upstream (legacy is true)
  } else {
    accessScopesContent = {
      scopes: getAppScopes(appConfiguration),
      use_legacy_install_flow: true,
    }
  }
  return {access_scopes: accessScopesContent}
}

function addLocalAppConfig(appConfiguration: AppConfiguration, remoteApp: OrganizationApp) {
  if (isCurrentAppSchema(appConfiguration)) {
    const {build, ...otherNonVersionedConfig} = appConfiguration
    return {...otherNonVersionedConfig, ...(appConfiguration.client_id === remoteApp.apiKey ? {build} : {})}
  } else {
    return {...appConfiguration}
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

function renderSuccessMessage(
  configFileName: string,
  remoteApp: OrganizationApp,
  localApp: AppInterface,
  useVersionedAppConfig: boolean,
) {
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
            `shopify app ${useVersionedAppConfig ? 'deploy' : 'config push'}`,
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
