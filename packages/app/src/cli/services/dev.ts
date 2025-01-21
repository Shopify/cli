import {
  ApplicationURLs,
  FrontendURLOptions,
  generateApplicationURLs,
  generateFrontendURL,
  getURLs,
  shouldOrPromptUpdateURLs,
  startTunnelPlugin,
  updateURLs,
} from './dev/urls.js'
import {
  enableDeveloperPreview,
  disableDeveloperPreview,
  developerPreviewUpdate,
  showReusedDevValues,
} from './context.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {installAppDependencies} from './dependencies.js'
import {DevConfig, DevProcesses, setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {frontAndBackendConfig} from './dev/processes/utils.js'
import {renderDev} from './dev/ui.js'
import {DeveloperPreviewController} from './dev/ui/components/Dev.js'
import {DevProcessFunction} from './dev/processes/types.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {canEnablePreviewMode} from './extensions/common.js'
import {fetchAppRemoteConfiguration} from './app/select-app.js'
import {patchAppConfigurationFile} from './app/patch-app-configuration-file.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {Web, isCurrentAppSchema, getAppScopesArray, AppLinkedInterface} from '../models/app/app.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {getAnalyticsTunnelType} from '../utilities/analytics.js'
import {ports} from '../constants.js'
import metadata from '../metadata.js'
import {AppConfigurationUsedByCli} from '../models/extensions/specifications/types/app_config.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {Config} from '@oclif/core'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {getBackendPort} from '@shopify/cli-kit/node/environment'
import {basename} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {OutputProcess, formatPackageManagerCommand, outputDebug} from '@shopify/cli-kit/node/output'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface DevOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  specifications: RemoteAwareExtensionSpecification[]
  developerPlatformClient: DeveloperPlatformClient
  store: OrganizationStore
  directory: string
  update: boolean
  commandConfig: Config
  skipDependenciesInstallation: boolean
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
  tunnelUrl?: string
  noTunnel: boolean
  theme?: string
  themeExtensionPort?: number
  notify?: string
  graphiqlPort?: number
  graphiqlKey?: string
}

export async function dev(commandOptions: DevOptions) {
  const config = await prepareForDev(commandOptions)
  await actionsBeforeSettingUpDevProcesses(config)
  const {processes, graphiqlUrl, previewUrl} = await setupDevProcesses(config)
  await actionsBeforeLaunchingDevProcesses(config)
  await launchDevProcesses({processes, previewUrl, graphiqlUrl, config})
}

async function prepareForDev(commandOptions: DevOptions): Promise<DevConfig> {
  const {app, remoteApp, developerPlatformClient, store, specifications} = commandOptions

  // Be optimistic about tunnel creation and do it as early as possible
  const tunnelPort = await getAvailableTCPPort()
  let tunnelClient: TunnelClient | undefined
  if (!commandOptions.tunnelUrl && !commandOptions.noTunnel) {
    tunnelClient = await startTunnelPlugin(commandOptions.commandConfig, tunnelPort, 'cloudflare')
  }

  const remoteConfiguration = await fetchAppRemoteConfiguration(
    remoteApp,
    developerPlatformClient,
    specifications,
    remoteApp.flags,
  )
  remoteApp.configuration = remoteConfiguration

  showReusedDevValues({
    app,
    remoteApp,
    selectedStore: store,
    cachedInfo: getCachedAppInfo(commandOptions.directory),
    organization: commandOptions.organization,
  })

  // If the dev_store_url is set in the app configuration, keep updating it.
  // If not, `store-context.ts` will take care of caching it in the hidden config.
  if (app.configuration.build?.dev_store_url) {
    app.configuration.build = {
      ...app.configuration.build,
      dev_store_url: store.shopDomain,
    }
    const patch = {build: {dev_store_url: store.shopDomain}}
    await patchAppConfigurationFile({path: app.configuration.path, patch, schema: app.configSchema})
  }

  if (!commandOptions.skipDependenciesInstallation && !app.usesWorkspaces) {
    await installAppDependencies(app)
  }

  const graphiqlPort = commandOptions.graphiqlPort || (await getAvailableTCPPort(ports.graphiql))
  const {graphiqlKey} = commandOptions

  if (graphiqlPort !== (commandOptions.graphiqlPort || ports.graphiql)) {
    renderWarning({
      headline: [
        'A random port will be used for GraphiQL because',
        {command: `${ports.graphiql}`},
        'is not available.',
      ],
      body: [
        'If you want to keep your session in GraphiQL, you can choose a different one by setting the',
        {command: '--graphiql-port'},
        'flag.',
      ],
    })
  }

  const {webs, ...network} = await setupNetworkingOptions(
    app.webs,
    graphiqlPort,
    {
      noTunnel: commandOptions.noTunnel,
      tunnelUrl: commandOptions.tunnelUrl,
    },
    tunnelClient,
    remoteApp.configuration,
  )
  app.webs = webs

  const cachedUpdateURLs = app.configuration.build?.automatically_update_urls_on_dev
  const previousAppId = getCachedAppInfo(commandOptions.directory)?.previousAppId
  const apiKey = remoteApp.apiKey

  const partnerUrlsUpdated = await handleUpdatingOfPartnerUrls(
    webs,
    commandOptions.update,
    network,
    app,
    cachedUpdateURLs,
    remoteApp,
    apiKey,
    developerPlatformClient,
  )

  return {
    storeFqdn: store.shopDomain,
    storeId: store.shopId,
    remoteApp,
    remoteAppUpdated: remoteApp.apiKey !== previousAppId,
    localApp: app,
    developerPlatformClient,
    commandOptions,
    network,
    partnerUrlsUpdated,
    graphiqlPort,
    graphiqlKey,
  }
}

async function actionsBeforeSettingUpDevProcesses(devConfig: DevConfig) {
  await warnIfScopesDifferBeforeDev(devConfig)
}

/**
 * Show a warning if the scopes in the local app configuration do not match the scopes in the remote app configuration.
 *
 * This is to flag that the developer may wish to run `shopify app deploy` to push the latest scopes.
 *
 */
export async function warnIfScopesDifferBeforeDev({
  localApp,
  remoteApp,
  developerPlatformClient,
}: Pick<DevConfig, 'localApp' | 'remoteApp' | 'developerPlatformClient'>) {
  if (developerPlatformClient.supportsDevSessions) return
  if (isCurrentAppSchema(localApp.configuration)) {
    const localAccess = localApp.configuration.access_scopes
    const remoteAccess = remoteApp.configuration?.access_scopes

    const rationaliseScopes = (scopeString: string | undefined) => {
      if (!scopeString) return scopeString
      return scopeString
        .split(',')
        .map((scope) => scope.trim())
        .sort()
        .join(',')
    }
    const localScopes = rationaliseScopes(localAccess?.scopes)
    const remoteScopes = rationaliseScopes(remoteAccess?.scopes)

    if (!localAccess?.use_legacy_install_flow && localScopes !== remoteScopes) {
      const nextSteps = [
        [
          'Run',
          {command: formatPackageManagerCommand(localApp.packageManager, 'shopify app deploy')},
          'to push your scopes to the Partner Dashboard',
        ],
      ]

      renderWarning({
        headline: [`The scopes in your TOML don't match the scopes in your Partner Dashboard`],
        body: [
          `Scopes in ${basename(localApp.configuration.path)}:`,
          scopesMessage(getAppScopesArray(localApp.configuration)),
          '\n',
          'Scopes in Partner Dashboard:',
          scopesMessage(remoteAccess?.scopes?.split(',') || []),
        ],
        nextSteps,
      })
    }
  }
}

async function actionsBeforeLaunchingDevProcesses(config: DevConfig) {
  setPreviousAppId(config.commandOptions.directory, config.remoteApp.apiKey)

  await logMetadataForDev({
    devOptions: config.commandOptions,
    tunnelUrl: config.network.proxyUrl,
    shouldUpdateURLs: config.partnerUrlsUpdated,
    storeFqdn: config.storeFqdn,
  })

  await reportAnalyticsEvent({config: config.commandOptions.commandConfig, exitMode: 'ok'})
}

async function handleUpdatingOfPartnerUrls(
  webs: Web[],
  commandSpecifiedToUpdate: boolean,
  network: {
    proxyUrl: string
    currentUrls: ApplicationURLs
  },
  localApp: AppLinkedInterface,
  cachedUpdateURLs: boolean | undefined,
  remoteApp: OrganizationApp,
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)
  let shouldUpdateURLs = false
  if (frontendConfig ?? backendConfig) {
    if (commandSpecifiedToUpdate) {
      const newURLs = generateApplicationURLs(
        network.proxyUrl,
        webs.map(({configuration}) => configuration.auth_callback_path).find((path) => path),
        localApp.configuration.app_proxy,
      )
      shouldUpdateURLs = await shouldOrPromptUpdateURLs({
        currentURLs: network.currentUrls,
        appDirectory: localApp.directory,
        cachedUpdateURLs,
        newApp: remoteApp.newApp,
        localApp,
        apiKey,
      })
      // When running dev app urls are pushed directly to API Client config instead of creating a new app version
      // so current app version and API Client config will have diferent url values.
      if (shouldUpdateURLs) {
        await updateURLs(newURLs, apiKey, developerPlatformClient, localApp)
        // eslint-disable-next-line require-atomic-updates
        localApp.devApplicationURLs = newURLs
      }
    }
  }
  return shouldUpdateURLs
}

async function setupNetworkingOptions(
  webs: Web[],
  graphiqlPort: number,
  frontEndOptions: Pick<FrontendURLOptions, 'noTunnel' | 'tunnelUrl'>,
  tunnelClient?: TunnelClient,
  remoteAppConfig?: AppConfigurationUsedByCli,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)

  await validateCustomPorts(webs, graphiqlPort)

  // generateFrontendURL still uses the old naming of frontendUrl and frontendPort,
  // we can rename them to proxyUrl and proxyPort when we delete dev.ts
  const [{frontendUrl, frontendPort: proxyPort, usingLocalhost}, backendPort, currentUrls] = await Promise.all([
    generateFrontendURL({
      ...frontEndOptions,
      tunnelClient,
    }),
    getBackendPort() || backendConfig?.configuration.port || getAvailableTCPPort(),
    getURLs(remoteAppConfig),
  ])
  const proxyUrl = usingLocalhost ? `${frontendUrl}:${proxyPort}` : frontendUrl

  let frontendPort = frontendConfig?.configuration.port
  if (frontendConfig) {
    if (!frontendPort) {
      frontendPort = frontendConfig === backendConfig ? backendPort : await getAvailableTCPPort()
    }
    frontendConfig.configuration.port = frontendPort
  }
  frontendPort = frontendPort ?? (await getAvailableTCPPort())

  return {
    proxyUrl,
    proxyPort,
    frontendPort,
    backendPort,
    currentUrls,
    webs,
  }
}

async function launchDevProcesses({
  processes,
  previewUrl,
  graphiqlUrl,
  config,
}: {
  processes: DevProcesses
  previewUrl: string
  graphiqlUrl: string | undefined
  config: DevConfig
}) {
  const abortController = new AbortController()
  const processesForTaskRunner: OutputProcess[] = processes.map((process) => {
    const outputProcess: OutputProcess = {
      prefix: process.prefix,
      action: async (stdout, stderr, signal) => {
        const fn = process.function as DevProcessFunction<typeof process.options>
        return fn({stdout, stderr, abortSignal: signal}, process.options)
      },
    }
    return outputProcess
  })

  const apiKey = config.remoteApp.apiKey
  const developerPlatformClient = config.developerPlatformClient
  const app = {
    canEnablePreviewMode: developerPlatformClient.supportsDevSessions
      ? false
      : await canEnablePreviewMode({
          localApp: config.localApp,
          developerPlatformClient,
          apiKey,
          organizationId: config.remoteApp.organizationId,
        }),
    developmentStorePreviewEnabled: config.remoteApp.developmentStorePreviewEnabled,
    apiKey,
    id: config.remoteApp.id,
    developerPlatformClient,
    extensions: config.localApp.allExtensions,
  }

  return renderDev({
    processes: processesForTaskRunner,
    previewUrl,
    graphiqlUrl,
    graphiqlPort: config.graphiqlPort,
    app,
    abortController,
    developerPreview: developerPreviewController(apiKey, developerPlatformClient),
    shopFqdn: config.storeFqdn,
  })
}

export function developerPreviewController(
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
): DeveloperPreviewController {
  if (developerPlatformClient.supportsDevSessions) {
    return {
      fetchMode: () => Promise.resolve(false),
      enable: () => Promise.resolve(),
      disable: () => Promise.resolve(),
      update: () => Promise.resolve(false),
    }
  }

  const refreshToken = async () => {
    await developerPlatformClient.refreshToken()
  }

  const withRefreshToken = async <T>(
    fn: (developerPlatformClient: DeveloperPlatformClient) => Promise<T>,
  ): Promise<T> => {
    try {
      const result = await performActionWithRetryAfterRecovery(async () => fn(developerPlatformClient), refreshToken)
      return result
    } catch (err) {
      outputDebug('Failed to refresh token')
      throw err
    }
  }

  return {
    fetchMode: async () =>
      withRefreshToken(async (developerPlatformClient: DeveloperPlatformClient) =>
        Boolean(await fetchAppPreviewMode(apiKey, developerPlatformClient)),
      ),
    enable: async () =>
      withRefreshToken(async (developerPlatformClient: DeveloperPlatformClient) => {
        await enableDeveloperPreview({apiKey, developerPlatformClient})
      }),
    disable: async () =>
      withRefreshToken(async (developerPlatformClient: DeveloperPlatformClient) => {
        await disableDeveloperPreview({apiKey, developerPlatformClient})
      }),
    update: async (state: boolean) =>
      withRefreshToken(async (developerPlatformClient: DeveloperPlatformClient) =>
        developerPreviewUpdate({apiKey, developerPlatformClient, enabled: state}),
      ),
  }
}

async function logMetadataForDev(options: {
  devOptions: DevOptions
  tunnelUrl: string
  shouldUpdateURLs: boolean
  storeFqdn: string
}) {
  const tunnelType = await getAnalyticsTunnelType(options.devOptions.commandConfig, options.tunnelUrl)
  await metadata.addPublicMetadata(() => ({
    cmd_dev_tunnel_type: tunnelType,
    cmd_dev_tunnel_custom_hash: tunnelType === 'custom' ? hashString(options.tunnelUrl) : undefined,
    cmd_dev_urls_updated: options.shouldUpdateURLs,
    store_fqdn_hash: hashString(options.storeFqdn),
    cmd_app_dependency_installation_skipped: options.devOptions.skipDependenciesInstallation,
  }))

  await metadata.addSensitiveMetadata(() => ({
    store_fqdn: options.storeFqdn,
    cmd_dev_tunnel_custom: tunnelType === 'custom' ? options.tunnelUrl : undefined,
  }))
}

function scopesMessage(scopes: string[]) {
  return {
    list: {
      items: scopes.length === 0 ? ['No scopes'] : scopes,
    },
  }
}

async function validateCustomPorts(webConfigs: Web[], graphiqlPort: number) {
  const allPorts = webConfigs.map((config) => config.configuration.port).filter((port) => port)
  const duplicatedPort = allPorts.find((port, index) => allPorts.indexOf(port) !== index)
  if (duplicatedPort) {
    throw new AbortError(`Found port ${duplicatedPort} for multiple webs.`, 'Please define a unique port for each web.')
  }
  await Promise.all([
    ...allPorts.map(async (port) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const portAvailable = await checkPortAvailability(port!)
      if (!portAvailable) {
        throw new AbortError(`Hard-coded port ${port} is not available, please choose a different one.`)
      }
    }),
    (async () => {
      const portAvailable = await checkPortAvailability(graphiqlPort)
      if (!portAvailable) {
        const errorMessage = `Port ${graphiqlPort} is not available for serving GraphiQL.`
        const tryMessage = ['Choose a different port by setting the', {command: '--graphiql-port'}, 'flag.']
        throw new AbortError(errorMessage, tryMessage)
      }
    })(),
  ])
}

function setPreviousAppId(directory: string, apiKey: string) {
  setCachedAppInfo({directory, previousAppId: apiKey})
}
