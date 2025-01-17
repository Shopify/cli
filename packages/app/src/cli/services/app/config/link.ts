import {setCurrentConfigPreference} from './use.js'
import {
  AppConfiguration,
  CurrentAppConfiguration,
  getAppVersionedSchema,
  isCurrentAppSchema,
  CliBuildPreferences,
  getAppScopes,
  LegacyAppConfiguration,
  AppCreationDefaultOptions,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {
  AppConfigurationFileName,
  AppConfigurationStateLinked,
  getAppConfigurationFileName,
  loadApp,
} from '../../../models/app/loader.js'
import {
  fetchOrCreateOrganizationApp,
  logMetadataForLoadedContext,
  appFromIdentifiers,
  InvalidApiKeyErrorMessage,
} from '../../context.js'
import {
  Flag,
  DeveloperPlatformClient,
  sniffServiceOptionsAndAppConfigToSelectPlatformClient,
} from '../../../utilities/developer-platform-client.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {RemoteAwareExtensionSpecification} from '../../../models/extensions/specification.js'
import {fetchAppRemoteConfiguration} from '../select-app.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {AppConfigurationUsedByCli} from '../../../models/extensions/specifications/types/app_config.js'
import {getTomls} from '../../../utilities/app/config/getTomls.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {deepMergeObjects, isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export interface LinkOptions {
  directory: string
  apiKey?: string
  appId?: string
  organizationId?: string
  configName?: string
  baseConfigName?: string
  developerPlatformClient?: DeveloperPlatformClient
  isNewApp?: boolean
}

interface LinkOutput {
  configuration: CurrentAppConfiguration
  remoteApp: OrganizationApp
  state: AppConfigurationStateLinked
}
/**
 * Link a local app configuration file to a remote app on the Shopify platform.
 *
 * This will fetch the remote app's configuration, merge it with the local app's configuration, and write it to the
 * filesystem. The user may be prompted to select or create an app on the platform; choose a configuration file
 * name etc.
 *
 * @param options - Options to control the linking process
 * @param shouldRenderSuccess - Whether to render a success message to the user. This is useful for testing.
 * @returns The final app configuration object that was written to the filesystem
 */
export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<LinkOutput> {
  // First, select (or create, if the user chooses to) a remote app to link to
  const {remoteApp, appDirectory, developerPlatformClient} = await selectOrCreateRemoteAppToLinkTo(options)

  // Then pull in the local app and gather options for the merge process
  const specifications = await fetchSpecifications({
    developerPlatformClient,
    app: remoteApp,
  })
  const flags = remoteApp.flags
  const localAppOptions = await loadLocalAppOptions(options, specifications, flags, remoteApp.apiKey)
  const configFileName = await loadConfigurationFileName(remoteApp, options, {
    appDirectory: localAppOptions.appDirectory,
    format: localAppOptions.configFormat,
  })

  await logMetadataForLoadedContext(remoteApp, developerPlatformClient.organizationSource)

  // Finally, merge the remote app's configuration with the local app's configuration, and write it to the filesystem
  const mergedAppConfiguration = await overwriteLocalConfigFileWithRemoteAppConfiguration({
    configFileName,
    remoteApp,
    developerPlatformClient,
    specifications,
    flags,
    appDirectory,
    localAppOptions,
  })

  if (shouldRenderSuccess) {
    renderSuccessMessage(configFileName, mergedAppConfiguration.name, localAppOptions.packageManager)
  }

  const state: AppConfigurationStateLinked = {
    state: 'connected-app',
    basicConfiguration: mergedAppConfiguration,
    appDirectory,
    configurationPath: joinPath(appDirectory, configFileName),
    configSource: options.configName ? 'flag' : 'cached',
    configurationFileName: configFileName,
  }

  return {configuration: mergedAppConfiguration, remoteApp, state}
}

/**
 * Choose or create an app on the platform to link to.
 *
 * If the called provided an API key directly, use the corresponding app. Otherwise, use prompts to select or create.
 *
 * Newly created apps will have some default options set -- these are based on the local app config.
 */
async function selectOrCreateRemoteAppToLinkTo(options: LinkOptions): Promise<{
  remoteApp: OrganizationApp
  appDirectory: string
  developerPlatformClient: DeveloperPlatformClient
}> {
  let developerPlatformClient = await sniffServiceOptionsAndAppConfigToSelectPlatformClient(options)

  const {creationOptions, appDirectory: possibleAppDirectory} = await getAppCreationDefaultsFromLocalApp(options)
  const appDirectory = possibleAppDirectory ?? options.directory

  if (options.apiKey) {
    // Remote API Key provided by the caller, so use that app specifically
    const remoteApp = await appFromIdentifiers({
      apiKey: options.apiKey,
      developerPlatformClient,
      organizationId: options.organizationId,
    })
    if (!remoteApp) {
      const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }

    return {
      remoteApp,
      appDirectory,
      developerPlatformClient,
    }
  }

  const remoteApp = await fetchOrCreateOrganizationApp(creationOptions, appDirectory)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  return {
    remoteApp,
    appDirectory,
    developerPlatformClient,
  }
}

/**
 * When linking, we may often need to create a new app. New apps need some default options set. We find these by
 * loading the local app.
 *
 * Note that this is somewhat of an incomplete load -- remote aware specs aren't used, it's unaware of remote flags,
 * etc.
 *
 * @returns Default options for creating a new app; the app's actual directory if loaded.
 */
async function getAppCreationDefaultsFromLocalApp(options: LinkOptions): Promise<{
  creationOptions: AppCreationDefaultOptions
  appDirectory?: string
}> {
  const appCreationDefaults = {
    isLaunchable: false,
    scopesArray: [] as string[],
    name: '',
  }
  try {
    const app = await loadApp({
      specifications: await loadLocalExtensionsSpecifications(),
      directory: options.directory,
      mode: 'report',
      userProvidedConfigName: options.baseConfigName,
      remoteFlags: undefined,
    })

    return {creationOptions: app.creationDefaultOptions(), appDirectory: app.directory}

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {creationOptions: appCreationDefaults}
  }
}

type LocalAppOptions =
  | {
      state: 'legacy'
      configFormat: 'legacy'
      scopes: string
      localAppIdMatchedRemote: false
      existingBuildOptions: undefined
      existingConfig: LegacyAppConfiguration
      appDirectory: string
      packageManager: PackageManager
    }
  | {
      state: 'reusable-current-app'
      configFormat: 'current'
      scopes: string
      localAppIdMatchedRemote: true
      existingBuildOptions: CliBuildPreferences
      existingConfig: CurrentAppConfiguration
      appDirectory: string
      packageManager: PackageManager
    }
  | ({
      scopes: ''
      existingBuildOptions: undefined
      existingConfig: undefined
      appDirectory: undefined
      packageManager: 'npm'
    } & (
      | {
          state: 'unable-to-reuse-current-config'
          configFormat: 'current'
          localAppIdMatchedRemote: true
        }
      | {
          state: 'unable-to-load-config'
          configFormat: 'legacy'
          localAppIdMatchedRemote: false
        }
    ))

/**
 * Load the local app configuration from the filesystem if possible, and extract options to use for the rest of the
 * linking process
 *
 * The existing config is only re-used if the app is in the current format and the client_id in the config file
 * matches that of the selected remote app, or the existing config is in legacy/freshly minted template format.
 *
 * @param specifications - Module specs to use for loading. These must have come from the platform.
 * @returns Either a loaded app, or some placeholder data
 */
async function loadLocalAppOptions(
  options: LinkOptions,
  specifications: RemoteAwareExtensionSpecification[],
  remoteFlags: Flag[],
  remoteAppApiKey: string,
): Promise<LocalAppOptions> {
  // Though we already loaded the app once, we have to go again now that we have the remote aware specifications in
  // place. We didn't have them earlier.
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
      return {
        state: 'legacy',
        configFormat: 'legacy',
        scopes: getAppScopes(configuration),
        localAppIdMatchedRemote: false,
        existingBuildOptions: undefined,
        existingConfig: configuration as LegacyAppConfiguration,
        appDirectory: app.directory,
        packageManager: app.packageManager,
      }
    } else if (app.configuration.client_id === remoteAppApiKey || options.isNewApp) {
      return {
        state: 'reusable-current-app',
        configFormat: 'current',
        scopes: getAppScopes(configuration),
        localAppIdMatchedRemote: true,
        existingBuildOptions: configuration.build,
        existingConfig: configuration,
        appDirectory: app.directory,
        packageManager: app.packageManager,
      }
    }
    return {
      state: 'unable-to-reuse-current-config',
      configFormat: 'current',
      scopes: '',
      localAppIdMatchedRemote: true,
      appDirectory: undefined,
      existingBuildOptions: undefined,
      existingConfig: undefined,
      packageManager: 'npm',
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      state: 'unable-to-load-config',
      configFormat: 'legacy',
      scopes: '',
      localAppIdMatchedRemote: false,
      appDirectory: undefined,
      existingBuildOptions: undefined,
      existingConfig: undefined,
      packageManager: 'npm',
    }
  }
}

/**
 * Gets the name of the configuration file to write to for this app
 *
 * @param remoteApp - Remote app this configuration will be linked to (or is already linked to)
 * @param localApp - Parsed local app configuration
 * @returns Configuration file name, e.g. 'shopify.app.toml', 'shopify.app.staging.toml'
 */
async function loadConfigurationFileName(
  remoteApp: OrganizationApp,
  options: LinkOptions,
  localAppInfo: {
    appDirectory?: string
    format: 'legacy' | 'current'
  },
): Promise<AppConfigurationFileName> {
  // If the user has already selected a config name, use that
  const cache = getCachedCommandInfo()
  if (cache?.selectedToml) return cache.selectedToml as AppConfigurationFileName

  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (localAppInfo.format === 'legacy') {
    return configurationFileNames.app
  }

  const existingTomls = await getTomls(options.directory)
  const currentToml = existingTomls[remoteApp.apiKey]
  if (currentToml) return currentToml

  return selectConfigName(localAppInfo.appDirectory || options.directory, remoteApp.title)
}

/**
 * Build a new app configuration object based on the remote app's modules, and write it to the filesystem, merging
 * with the existing local file.
 */
async function overwriteLocalConfigFileWithRemoteAppConfiguration(options: {
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  specifications: RemoteAwareExtensionSpecification[]
  flags: Flag[]
  configFileName: AppConfigurationFileName
  appDirectory: string
  localAppOptions: LocalAppOptions
}): Promise<CurrentAppConfiguration> {
  const {remoteApp, developerPlatformClient, specifications, flags, configFileName, appDirectory, localAppOptions} =
    options
  const configFilePath = joinPath(appDirectory, configFileName)
  let remoteAppConfiguration = await fetchAppRemoteConfiguration(
    remoteApp,
    developerPlatformClient,
    specifications,
    flags,
  )
  if (!remoteAppConfiguration) {
    const locallyProvidedScopes = localAppOptions.scopes
    remoteAppConfiguration = buildAppConfigurationFromRemoteAppProperties(remoteApp, locallyProvidedScopes)
  }

  const replaceLocalArrayStrategy = (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray

  const mergedAppConfiguration = {
    ...deepMergeObjects<AppConfiguration, CurrentAppConfiguration>(
      {
        ...(localAppOptions.existingConfig ?? {}),
      },
      {
        client_id: remoteApp.apiKey,
        path: configFilePath,
        ...(developerPlatformClient.requiresOrganization ? {organization_id: remoteApp.organizationId} : {}),
        ...remoteAppConfiguration,
      },
      replaceLocalArrayStrategy,
    ),
    // Always use our prefered build options
    build: buildOptionsForGeneratedConfigFile({
      existingBuildOptions: localAppOptions.existingBuildOptions,
      linkedAppAndClientIdFromFileAreInSync: localAppOptions.localAppIdMatchedRemote,
      linkedAppWasNewlyCreated: Boolean(remoteApp.newApp),
    }),
  }

  // We were previously forcing scopes to be undefined, because scopes is no longer a top-level key.
  // This works fine when writing to a file, but not when trying to parse the config object again in code.
  // Make sure to delete it so that parsing works.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (mergedAppConfiguration as any).scopes

  // Always output using the canonical schema
  const schema = getAppVersionedSchema(specifications)
  await writeAppConfigurationFile(mergedAppConfiguration, schema)
  setCurrentConfigPreference(mergedAppConfiguration, {configFileName, directory: appDirectory})

  return mergedAppConfiguration
}

/**
 * Put together the default options for the `build` section in an app configuration.
 */
function buildOptionsForGeneratedConfigFile(options: {
  existingBuildOptions: CliBuildPreferences
  linkedAppAndClientIdFromFileAreInSync: boolean
  linkedAppWasNewlyCreated: boolean
}): CliBuildPreferences {
  const {existingBuildOptions, linkedAppAndClientIdFromFileAreInSync, linkedAppWasNewlyCreated} = options
  const buildOptions = {
    ...(linkedAppWasNewlyCreated ? {include_config_on_deploy: true} : {}),
    ...(linkedAppAndClientIdFromFileAreInSync ? existingBuildOptions : {}),
  }
  if (isEmpty(buildOptions)) {
    return undefined
  } else {
    return buildOptions
  }
}

function renderSuccessMessage(configFileName: string, appName: string, packageManager: PackageManager) {
  renderSuccess({
    headline: `${configFileName} is now linked to "${appName}" on Shopify`,
    body: `Using ${configFileName} as your default config.`,
    nextSteps: [
      [`Make updates to ${configFileName} in your local project`],
      [
        'To upload your config, run',
        {
          command: formatPackageManagerCommand(packageManager, 'shopify app deploy'),
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
 * This is a fallback in case the remote app didn't have configuration modules in place.
 *
 * @param remoteApp - The remote app to build the configuration for. Configuration will typically come straight from here.
 * @param appConfiguration - The local app configuration already in place. This is used only for pulling in data that came from the app template.
 * @returns - A top-level app configuration object to use locally.
 */
function buildAppConfigurationFromRemoteAppProperties(
  remoteApp: OrganizationApp,
  locallyProvidedScopes: string,
): AppConfigurationUsedByCli {
  return {
    ...addBrandingConfig(remoteApp),
    ...addPosConfig(remoteApp),
    ...addRemoteAppWebhooksConfig(remoteApp),
    ...addRemoteAppAccessConfig(locallyProvidedScopes, remoteApp),
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

function addRemoteAppAccessConfig(locallyProvidedScopes: string, remoteApp: OrganizationApp) {
  let accessScopesContent = {}
  // if we have upstream scopes, use them
  if (remoteApp.requestedAccessScopes) {
    accessScopesContent = {
      scopes: remoteApp.requestedAccessScopes.join(','),
    }
    // if we can't find scopes or have to fall back, omit setting a scope and set legacy to true
  } else if (locallyProvidedScopes === '') {
    accessScopesContent = {
      use_legacy_install_flow: true,
    }
    // if we have scopes locally and not upstream, preserve them but don't push them upstream (legacy is true)
  } else {
    accessScopesContent = {
      scopes: locallyProvidedScopes,
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
