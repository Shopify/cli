import {saveCurrentConfig} from './use.js'
import {
  AppConfiguration,
  AppInterface,
  EmptyApp,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp, logMetadataForLoadedContext} from '../../context.js'
import {BetaFlag} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {ExtensionSpecification} from '../../../models/extensions/specification.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {fetchAppRemoteConfiguration} from '../select-app.js'
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
  const remoteAppConfiguration = await fetchAppRemoteConfiguration(
    remoteApp.apiKey,
    developerPlatformClient,
    localApp.specifications ?? [],
    localApp.remoteBetaFlags,
  )
  const replaceLocalArrayStrategy = (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray
  configuration = deepMergeObjects(configuration, remoteAppConfiguration, replaceLocalArrayStrategy)

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
  const specifications = await options.developerPlatformClient!.specifications(remoteApp.apiKey)
  const localApp = await loadAppOrEmptyApp(options, specifications, remoteApp.betas, remoteApp)
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
  remoteBetas?: BetaFlag[],
  remoteApp?: OrganizationApp,
): Promise<AppInterface> {
  try {
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: options.baseConfigName,
      remoteBetas,
    })
    const configuration = app.configuration
    if (!isCurrentAppSchema(configuration) || remoteApp?.apiKey === configuration.client_id) return app
    return new EmptyApp(await loadLocalExtensionsSpecifications(), remoteBetas, remoteApp?.apiKey)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return new EmptyApp(await loadLocalExtensionsSpecifications(), remoteBetas)
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
  const app = await developerPlatformClient.appFromId(apiKey)
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
