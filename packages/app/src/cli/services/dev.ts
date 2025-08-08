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
import {setAppConfigValue} from './app/patch-app-configuration-file.js'
import {DevSessionStatusManager} from './dev/processes/dev-session/dev-session-status-manager.js'
import {TunnelMode} from './dev/tunnel-mode.js'
import {PortDetail, renderPortWarnings} from './dev/port-warnings.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {Web, isCurrentAppSchema, getAppScopesArray, AppLinkedInterface} from '../models/app/app.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {getAnalyticsTunnelType} from '../utilities/analytics.js'
import metadata from '../metadata.js'
import {AppConfigurationUsedByCli} from '../models/extensions/specifications/types/app_config.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {ports} from '../constants.js'
import {generateCertificate} from '../utilities/mkcert.js'
import {Config} from '@oclif/core'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {getBackendPort} from '@shopify/cli-kit/node/environment'
import {basename} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {OutputProcess, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
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
  tunnel: TunnelMode
  theme?: string
  themeExtensionPort?: number
  notify?: string
  graphiqlPort?: number
  graphiqlKey?: string
}

export async function dev(commandOptions: DevOptions) {
  const config = await prepareForDev(commandOptions)
  await actionsBeforeSettingUpDevProcesses(config)
  const {processes, graphiqlUrl, previewUrl, devSessionStatusManager} = await setupDevProcesses(config)
  await actionsBeforeLaunchingDevProcesses(config)
  await launchDevProcesses({processes, previewUrl, graphiqlUrl, config, devSessionStatusManager})
}

async function prepareForDev(commandOptions: DevOptions): Promise<DevConfig> {
  const {app, remoteApp, developerPlatformClient, store, specifications, tunnel} = commandOptions

  // Be optimistic about tunnel creation and do it as early as possible
  let tunnelClient: TunnelClient | undefined

  if (tunnel.mode === 'auto') {
    const tunnelPort = await getAvailableTCPPort()
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
    tunnelMode: tunnel.mode,
  })

  // If the dev_store_url is set in the app configuration, keep updating it.
  // If not, `store-context.ts` will take care of caching it in the hidden config.
  if (app.configuration.build?.dev_store_url) {
    app.configuration.build = {
      ...app.configuration.build,
      dev_store_url: store.shopDomain,
    }
    await setAppConfigValue(app.configuration.path, 'build.dev_store_url', store.shopDomain)
  }

  if (!commandOptions.skipDependenciesInstallation && !app.usesWorkspaces) {
    await installAppDependencies(app)
  }

  const graphiqlPort = commandOptions.graphiqlPort ?? (await getAvailableTCPPort(ports.graphiql))
  const portDetails: PortDetail[] = [
    {
      for: 'GraphiQL',
      flagToRemedy: '--graphiql-port',
      requested: commandOptions.graphiqlPort ?? ports.graphiql,
      actual: graphiqlPort,
    },
  ]

  if (tunnel.mode === 'use-localhost') {
    portDetails.push({
      for: 'localhost',
      flagToRemedy: '--localhost-port',
      requested: tunnel.requestedPort,
      actual: tunnel.actualPort,
    })
  }

  renderPortWarnings(portDetails)

  const {webs, ...network} = await setupNetworkingOptions(
    app.directory,
    app.webs,
    graphiqlPort,
    tunnel,
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
    graphiqlKey: commandOptions.graphiqlKey,
  }
}

async function actionsBeforeSettingUpDevProcesses(devConfig: DevConfig) {
  await warnIfScopesDifferBeforeDev(devConfig)
  await blockIfMigrationIncomplete(devConfig)
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
          scopesMessage(remoteAccess?.scopes?.split(',') ?? []),
        ],
        nextSteps,
      })
    }
  }
}

export async function blockIfMigrationIncomplete(devConfig: DevConfig) {
  const {developerPlatformClient, remoteApp} = devConfig
  const remoteExtensions = (await developerPlatformClient.appExtensionRegistrations(remoteApp)).app
    .extensionRegistrations
  if (developerPlatformClient.supportsDevSessions && !remoteExtensions.every((extension) => extension.id)) {
    const message = [`Your app includes extensions that need to be migrated to the Next-Gen Dev Platform.`]
    const nextSteps = ['Run', {command: 'shopify app deploy'}, 'to finish the migration.']
    throw new AbortError(message, nextSteps)
  }
}

async function actionsBeforeLaunchingDevProcesses(config: DevConfig) {
  setCachedAppInfo({directory: config.commandOptions.directory, previousAppId: config.remoteApp.apiKey})

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
        newURLs,
        developerPlatformClient,
      })

      if (shouldUpdateURLs) {
        if (developerPlatformClient.supportsDevSessions) {
          // For dev sessions, store the new URLs in the local app so that the manifest can be patched with them
          // The local toml is not updated.
          localApp.setDevApplicationURLs(newURLs)
        } else {
          // When running dev app urls are pushed directly to API Client config instead of creating a new app version
          // so current app version and API Client config will have diferent url values.
          await updateURLs(newURLs, apiKey, developerPlatformClient, localApp)
        }
      }
    }
  }
  return shouldUpdateURLs
}

async function setupNetworkingOptions(
  appDirectory: string,
  webs: Web[],
  graphiqlPort: number,
  tunnelOptions: TunnelMode,
  tunnelClient?: TunnelClient,
  remoteAppConfig?: AppConfigurationUsedByCli,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)

  await validateCustomPorts(webs, graphiqlPort)

  const frontendUrlOptions: FrontendURLOptions =
    tunnelOptions.mode === 'use-localhost'
      ? {
          noTunnelUseLocalhost: true,
          port: tunnelOptions.actualPort,
        }
      : {
          noTunnelUseLocalhost: false,
          tunnelUrl: tunnelOptions.mode === 'custom' ? tunnelOptions.url : undefined,
          tunnelClient,
        }

  // generateFrontendURL still uses the old naming of frontendUrl and frontendPort,
  // we can rename them to proxyUrl and proxyPort when we delete dev.ts
  const [{frontendUrl, frontendPort: proxyPort, usingLocalhost}, backendPort, currentUrls] = await Promise.all([
    generateFrontendURL(frontendUrlOptions),
    getBackendPort() ?? backendConfig?.configuration.port ?? getAvailableTCPPort(),
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

  let reverseProxyCert
  if (tunnelOptions.mode === 'use-localhost') {
    const {keyContent, certContent, certPath} = await generateCertificate({
      appDirectory,
    })

    reverseProxyCert = {
      key: keyContent,
      cert: certContent,
      certPath,
      port: tunnelOptions.actualPort,
    }
  }

  return {
    proxyUrl,
    proxyPort,
    frontendPort,
    backendPort,
    currentUrls,
    webs,
    reverseProxyCert,
  }
}

async function launchDevProcesses({
  processes,
  previewUrl,
  graphiqlUrl,
  config,
  devSessionStatusManager,
}: {
  processes: DevProcesses
  previewUrl: string
  graphiqlUrl: string | undefined
  config: DevConfig
  devSessionStatusManager: DevSessionStatusManager
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
    devSessionStatusManager,
    appURL: config.localApp.devApplicationURLs?.applicationUrl,
    appName: config.remoteApp.title,
    organizationName: config.commandOptions.organization.businessName,
    configPath: config.localApp.configuration.path,
  })
}

function developerPreviewController(
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
): DeveloperPreviewController {
  if (developerPlatformClient.supportsDevSessions) {
    return {
      fetchMode: () => Promise.resolve(false),
      enable: () => Promise.resolve(false),
      disable: () => Promise.resolve(),
      update: () => Promise.resolve(false),
    }
  }

  return {
    fetchMode: async () => Boolean(await fetchAppPreviewMode(apiKey, developerPlatformClient)),
    enable: async () => enableDeveloperPreview({apiKey, developerPlatformClient}),
    disable: async () => disableDeveloperPreview({apiKey, developerPlatformClient}),
    update: async (state: boolean) => developerPreviewUpdate({apiKey, developerPlatformClient, enabled: state}),
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
        const tryMessage = ['Choose a different port for the', {command: '--graphiql-port'}, 'flag.']
        throw new AbortError(errorMessage, tryMessage)
      }
    })(),
  ])
}
