import {saveCurrentConfig} from './use.js'
import {
  AppConfiguration,
  AppInterface,
  EmptyApp,
  getAppScopes,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {
  InvalidApiKeyErrorMessage,
  fetchOrCreateOrganizationApp,
  logMetadataForLoadedContext,
  appFromId,
} from '../../context.js'
import {Flag} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {ExtensionSpecification} from '../../../models/extensions/specification.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {fetchAppRemoteConfiguration} from '../select-app.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {SpecsAppConfiguration} from '../../../models/extensions/specifications/types/app_config.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {deepMergeObjects, isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'

export interface LinkOptions {
  directory: string
  apiKey?: string
  configName?: string
  baseConfigName?: string
  developerPlatformClient?: DeveloperPlatformClient
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<AppConfiguration> {
  const developerPlatformClient = options.developerPlatformClient ?? selectDeveloperPlatformClient()
  const updatedOptions = {...options, developerPlatformClient}
  const {remoteApp, directory} = await selectRemoteApp(updatedOptions)
  const {localApp, configFileName, configFilePath} = await loadLocalApp(updatedOptions, remoteApp, directory)

  await logMetadataForLoadedContext(remoteApp)

  let configuration = addLocalAppConfig(localApp.configuration, remoteApp, configFilePath)
  const remoteAppConfiguration =
    (await fetchAppRemoteConfiguration(
      remoteApp,
      developerPlatformClient,
      localApp.specifications ?? [],
      localApp.remoteFlags,
    )) ?? buildRemoteApiClientConfiguration(configuration, remoteApp)
  const replaceLocalArrayStrategy = (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray
  configuration = deepMergeObjects(
    configuration,
    {
      ...(developerPlatformClient.requiresOrganization ? {organization_id: remoteApp.organizationId} : {}),
      ...remoteAppConfiguration,
    },
    replaceLocalArrayStrategy,
  )

  await writeAppConfigurationFile(configuration, localApp.configSchema)
  await saveCurrentConfig({configFileName, directory})

  if (shouldRenderSuccess) {
    renderSuccessMessage(configFileName, remoteAppConfiguration.name, localApp)
  }

  return configuration
}

async function selectRemoteApp(options: LinkOptions & Required<Pick<LinkOptions, 'developerPlatformClient'>>) {
  const localApp = await loadAppOrEmptyApp(options)
  const directory = localApp?.directory || options.directory
  const remoteApp = await loadRemoteApp(localApp, options.apiKey, options.developerPlatformClient, directory)
  return {
    remoteApp,
    directory,
  }
}

async function loadLocalApp(options: LinkOptions, remoteApp: OrganizationApp, directory: string) {
  const specifications = await fetchSpecifications({
    developerPlatformClient: options.developerPlatformClient!,
    apiKey: remoteApp.apiKey,
  })
  const localApp = await loadAppOrEmptyApp(options, specifications, remoteApp.flags, remoteApp)
  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(directory, configFileName)
  return {
    localApp,
    configFileName,
    configFilePath,
  }
}

async function loadAppOrEmptyApp(
  options: LinkOptions,
  specifications?: ExtensionSpecification[],
  remoteFlags?: Flag[],
  remoteApp?: OrganizationApp,
): Promise<AppInterface> {
  try {
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: options.baseConfigName,
      remoteFlags,
    })
    const configuration = app.configuration
    if (!isCurrentAppSchema(configuration) || remoteApp?.apiKey === configuration.client_id) return app
    return new EmptyApp(await loadLocalExtensionsSpecifications(), remoteFlags, remoteApp?.apiKey)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return new EmptyApp(await loadLocalExtensionsSpecifications(), remoteFlags)
  }
}

async function loadRemoteApp(
  localApp: AppInterface,
  apiKey: string | undefined,
  developerPlatformClient: DeveloperPlatformClient,
  directory?: string,
): Promise<OrganizationApp> {
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, developerPlatformClient, directory)
  }
  const app = await appFromId({apiKey, developerPlatformClient})
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

  if (isLegacyAppSchema(localApp.configuration)) {
    return configurationFileNames.app
  }

  const configName = await selectConfigName(localApp.directory || options.directory, remoteApp.title)
  return `shopify.app.${configName}.toml`
}

function addLocalAppConfig(appConfiguration: AppConfiguration, remoteApp: OrganizationApp, configFilePath: string) {
  let localAppConfig = {
    ...appConfiguration,
    client_id: remoteApp.apiKey,
    path: configFilePath,
  }
  if (isCurrentAppSchema(localAppConfig)) {
    delete localAppConfig.auth
    const build = {
      ...(remoteApp.newApp ? {include_config_on_deploy: true} : {}),
      ...(appConfiguration.client_id === remoteApp.apiKey ? localAppConfig.build : {}),
    }
    if (isEmpty(build)) {
      delete localAppConfig.build
    } else {
      localAppConfig = {
        ...localAppConfig,
        build,
      }
    }
  }
  return localAppConfig
}

function renderSuccessMessage(configFileName: string, appName: string, localApp: AppInterface) {
  renderSuccess({
    headline: `${configFileName} is now linked to "${appName}" on Shopify`,
    body: `Using ${configFileName} as your default config.`,
    nextSteps: [
      [`Make updates to ${configFileName} in your local project`],
      [
        'To upload your config, run',
        {
          command: formatPackageManagerCommand(localApp.packageManager, 'shopify app deploy'),
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

function buildRemoteApiClientConfiguration(
  appConfiguration: AppConfiguration,
  remoteApp: OrganizationApp,
): SpecsAppConfiguration {
  return {
    ...addBrandingConfig(remoteApp),
    ...addPosConfig(remoteApp),
    ...addRemoteAppWebhooksConfig(remoteApp),
    ...addRemoteAppAccessConfig(appConfiguration, remoteApp),
    ...addRemoteAppProxyConfig(remoteApp),
    ...addRemoteAppHomeConfig(remoteApp),
  }
}

function addRemoteAppHomeConfig(remoteApp: OrganizationApp) {
  const homeConfig = {
    application_url: remoteApp.applicationUrl?.replace(/\/$/, '') || '',
    embedded: remoteApp.embedded === undefined ? true : remoteApp.embedded,
  }
  return remoteApp.preferencesUrl
    ? {
        ...homeConfig,
        app_preferences: {
          url: remoteApp.preferencesUrl,
        },
      }
    : {...homeConfig}
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

function addRemoteAppAccessConfig(appConfiguration: AppConfiguration, remoteApp: OrganizationApp) {
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
  return {
    auth: {
      redirect_urls: remoteApp.redirectUrlWhitelist ?? [],
    },
    access_scopes: accessScopesContent,
  }
}

function addPosConfig(remoteApp: OrganizationApp) {
  return {
    pos: {
      embedded: remoteApp.posEmbedded || false,
    },
  }
}

function addBrandingConfig(remoteApp: OrganizationApp) {
  return {
    name: remoteApp.title,
  }
}
