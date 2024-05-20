import {setCurrentConfigPreference} from './use.js'
import {
  AppConfiguration,
  AppConfigurationInterface,
  AppInterface,
  PartialAppInterface,
  BasicAppConfigurationWithoutModules,
  CurrentAppConfiguration,
  getAppScopes,
  getAppVersionedSchema,
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
import {
  DeveloperPlatformClient,
  sniffServiceOptionsAndAppConfigToSelectPlatformClient,
} from '../../../utilities/developer-platform-client.js'
import {fetchAppRemoteConfiguration} from '../select-app.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {SpecsAppConfiguration} from '../../../models/extensions/specifications/types/app_config.js'
import {getTomls} from '../../../utilities/app/config/getTomls.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {deepMergeObjects, isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'

type ConfigOutput = Pick<AppConfigurationInterface, 'configuration' | 'configSchema'>

export function emptyApp(
  specifications?: ExtensionSpecification[],
  flags?: Flag[],
  clientId?: string,
): PartialAppInterface {
  const config: ConfigOutput = clientId
    ? {
        configuration: {
          client_id: clientId,
          access_scopes: {scopes: ''},
          path: '',
        } as BasicAppConfigurationWithoutModules,
        configSchema: getAppVersionedSchema(specifications ?? []),
      }
    : {
        configuration: {scopes: '', path: ''},
        configSchema: getAppVersionedSchema(specifications ?? []),
      }

  return {
    directory: '',
    ...config,
    name: '',
    packageManager: 'npm',
    specifications: specifications ?? [],
    remoteFlags: flags ?? [],
    appIsLaunchable: () => false,
  }
}

export interface LinkOptions {
  directory: string
  apiKey?: string
  configName?: string
  baseConfigName?: string
  developerPlatformClient?: DeveloperPlatformClient
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<CurrentAppConfiguration> {
  let developerPlatformClient = await sniffServiceOptionsAndAppConfigToSelectPlatformClient(options)

  const {remoteApp, directory} = await selectRemoteApp({...options, developerPlatformClient})
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient
  const {localApp, configFileName, configFilePath} = await loadLocalApp(
    {...options, developerPlatformClient},
    remoteApp,
    directory,
  )

  await logMetadataForLoadedContext(remoteApp)

  const configuration = addLocalAppConfig(localApp.configuration, remoteApp, configFilePath)

  let remoteAppConfiguration = await fetchAppRemoteConfiguration(
    remoteApp,
    developerPlatformClient,
    localApp.specifications ?? [],
    localApp.remoteFlags,
  )
  // TODO this might be droppable -- if remote apps always have an active version and some modules?
  if (!remoteAppConfiguration) {
    remoteAppConfiguration = buildAppConfigurationFromRemoteAppProperties(remoteApp, configuration)
  }

  const replaceLocalArrayStrategy = (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray
  const configurationIncludingRemote: CurrentAppConfiguration = deepMergeObjects(
    configuration,
    {
      ...(developerPlatformClient.requiresOrganization ? {organization_id: remoteApp.organizationId} : {}),
      ...remoteAppConfiguration,
    },
    replaceLocalArrayStrategy,
  )

  await writeAppConfigurationFile(configurationIncludingRemote, localApp.configSchema)
  await setCurrentConfigPreference(configurationIncludingRemote, {configFileName, directory})

  if (shouldRenderSuccess) {
    renderSuccessMessage(configFileName, remoteAppConfiguration.name, localApp)
  }

  return configurationIncludingRemote
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

/**
 * Attempts to load the app from the local file system, with fallback behaviour.
 *
 * The app itself is returned if the app has already been linked to the remote app, and its a match for the provided remote app.
 *
 * It is also returned if it is still using legacy config -- i.e. it's fresh from the template.
 *
 * Otherwise, return an empty app -- a placeholder that stores only the remote app's API key.
 *
 */
async function loadAppOrEmptyApp(
  options: LinkOptions,
  specifications?: ExtensionSpecification[],
  remoteFlags?: Flag[],
  remoteApp?: OrganizationApp,
): Promise<PartialAppInterface | AppInterface> {
  try {
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      userProvidedConfigName: options.baseConfigName,
      remoteFlags,
    })
    const configuration = app.configuration

    if (!isCurrentAppSchema(configuration)) {
      return app
    } else if (remoteApp?.apiKey === configuration.client_id) {
      return app
    } else {
      return emptyApp(await loadLocalExtensionsSpecifications(), remoteFlags, remoteApp?.apiKey)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return emptyApp(await loadLocalExtensionsSpecifications(), remoteFlags)
  }
}

async function loadRemoteApp(
  localApp: PartialAppInterface,
  apiKey: string | undefined,
  developerPlatformClient: DeveloperPlatformClient,
  directory?: string,
): Promise<OrganizationApp> {
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, directory)
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
  localApp: AppConfigurationInterface,
): Promise<string> {
  const cache = getCachedCommandInfo()

  if (!cache?.askConfigName && cache?.selectedToml) return cache.selectedToml as string

  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (isLegacyAppSchema(localApp.configuration)) {
    return configurationFileNames.app
  }

  const existingTomls = await getTomls(options.directory)
  const currentToml = existingTomls[remoteApp.apiKey]
  if (currentToml) return currentToml

  return selectConfigName(localApp.directory || options.directory, remoteApp.title)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((localAppConfig as any).scopes === '') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (localAppConfig as any).scopes
    }
  }
  return localAppConfig
}

function renderSuccessMessage(configFileName: string, appName: string, localApp: PartialAppInterface) {
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

/**
 * Given a remote app, and some local app configuration, build a top-level app configuration object to use locally.
 *
 * @param remoteApp - The remote app to build the configuration for. Configuration will typically come straight from here.
 * @param appConfiguration - The local app configuration already in place. This is used only for pulling in data that came from the app template.
 * @returns - A top-level app configuration object to use locally.
 */
function buildAppConfigurationFromRemoteAppProperties(
  remoteApp: OrganizationApp,
  appConfiguration: AppConfiguration,
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
