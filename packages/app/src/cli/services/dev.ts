import {
  FrontendURLOptions,
  PartnersURLs,
  generateFrontendURL,
  generatePartnersURLs,
  getURLs,
  shouldOrPromptUpdateURLs,
  startTunnelPlugin,
  updateURLs,
} from './dev/urls.js'
import {ensureDevContext, enableDeveloperPreview, disableDeveloperPreview, developerPreviewUpdate} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {installAppDependencies} from './dependencies.js'
import {DevConfig, DevProcesses, setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {frontAndBackendConfig} from './dev/processes/utils.js'
import {outputUpdateURLsResult, renderDev} from './dev/ui.js'
import {DeveloperPreviewController} from './dev/ui/components/Dev.js'
import {DevProcessFunction} from './dev/processes/types.js'
import {setCachedAppInfo} from './local-storage.js'
import {canEnablePreviewMode} from './extensions/common.js'
import {fetchPartnersSession} from './context/partner-account-info.js'
import {loadApp} from '../models/app/loader.js'
import {Web, isCurrentAppSchema, getAppScopesArray, AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {OrganizationApp} from '../models/organization.js'
import {getAnalyticsTunnelType} from '../utilities/analytics.js'
import metadata from '../metadata.js'
import {Config} from '@oclif/core'
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
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export interface DevOptions {
  directory: string
  id?: number
  configName?: string
  apiKey?: string
  storeFqdn?: string
  reset: boolean
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
}

export async function dev(commandOptions: DevOptions) {
  const config = await prepareForDev(commandOptions)
  await actionsBeforeSettingUpDevProcesses(config)
  const {processes, graphiqlUrl, previewUrl} = await setupDevProcesses(config)
  await actionsBeforeLaunchingDevProcesses(config)
  await launchDevProcesses({processes, previewUrl, graphiqlUrl, config})
}

async function prepareForDev(commandOptions: DevOptions): Promise<DevConfig> {
  // Be optimistic about tunnel creation and do it as early as possible
  const tunnelPort = await getAvailableTCPPort()
  let tunnelClient: TunnelClient | undefined
  if (!commandOptions.tunnelUrl && !commandOptions.noTunnel) {
    tunnelClient = await startTunnelPlugin(commandOptions.commandConfig, tunnelPort, 'cloudflare')
  }

  const partnersSession = await fetchPartnersSession()
  const token = partnersSession.token
  const {
    storeFqdn,
    storeId,
    remoteApp,
    remoteAppUpdated,
    updateURLs: cachedUpdateURLs,
  } = await ensureDevContext(commandOptions, partnersSession)

  const apiKey = remoteApp.apiKey
  const specifications = await fetchSpecifications({token, apiKey, config: commandOptions.commandConfig})
  let localApp = await loadApp({
    directory: commandOptions.directory,
    specifications,
    configName: commandOptions.configName,
  })

  if (!commandOptions.skipDependenciesInstallation && !localApp.usesWorkspaces) {
    localApp = await installAppDependencies(localApp)
  }

  const {webs, ...network} = await setupNetworkingOptions(
    localApp.webs,
    apiKey,
    token,
    {
      noTunnel: commandOptions.noTunnel,
      commandConfig: commandOptions.commandConfig,
      tunnelUrl: commandOptions.tunnelUrl,
    },
    tunnelClient,
  )
  localApp.webs = webs

  const partnerUrlsUpdated = await handleUpdatingOfPartnerUrls(
    webs,
    commandOptions.update,
    network,
    localApp,
    cachedUpdateURLs,
    remoteApp,
    apiKey,
    token,
  )

  // If we have a real UUID for an extension, use that instead of a random one
  const allExtensionsWithDevUUIDs = getDevUUIDsForAllExtensions(localApp, apiKey)
  localApp.allExtensions = allExtensionsWithDevUUIDs

  return {
    storeFqdn,
    storeId,
    remoteApp,
    remoteAppUpdated,
    localApp,
    token,
    commandOptions,
    network,
    partnerUrlsUpdated,
  }
}

async function actionsBeforeSettingUpDevProcesses({localApp, remoteApp}: DevConfig) {
  if (
    isCurrentAppSchema(localApp.configuration) &&
    !localApp.configuration.access_scopes?.use_legacy_install_flow &&
    getAppScopesArray(localApp.configuration).sort().join(',') !== remoteApp.requestedAccessScopes?.sort().join(',')
  ) {
    const nextSteps = [
      [
        'Run',
        {command: formatPackageManagerCommand(localApp.packageManager, 'shopify app config push')},
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
        scopesMessage(remoteApp.requestedAccessScopes || []),
      ],
      nextSteps,
    })
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

function getDevUUIDsForAllExtensions(localApp: AppInterface, apiKey: string) {
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})
  const envExtensionsIds = prodEnvIdentifiers.extensions || {}
  const extensionsIds = prodEnvIdentifiers.app === apiKey ? envExtensionsIds : {}

  return localApp.allExtensions.map((ext) => {
    ext.devUUID = extensionsIds[ext.localIdentifier] ?? ext.devUUID
    return ext
  })
}

async function handleUpdatingOfPartnerUrls(
  webs: Web[],
  commandSpecifiedToUpdate: boolean,
  network: {
    proxyUrl: string
    currentUrls: PartnersURLs
  },
  localApp: AppInterface,
  cachedUpdateURLs: boolean | undefined,
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string | undefined},
  apiKey: string,
  token: string,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)
  let shouldUpdateURLs = false
  if (frontendConfig || backendConfig) {
    if (commandSpecifiedToUpdate) {
      const newURLs = generatePartnersURLs(
        network.proxyUrl,
        webs.map(({configuration}) => configuration.auth_callback_path).find((path) => path),
        isCurrentAppSchema(localApp.configuration) ? localApp.configuration.app_proxy : undefined,
      )
      shouldUpdateURLs = await shouldOrPromptUpdateURLs({
        currentURLs: network.currentUrls,
        appDirectory: localApp.directory,
        cachedUpdateURLs,
        newApp: remoteApp.newApp,
        localApp,
        apiKey,
      })
      if (shouldUpdateURLs) await updateURLs(newURLs, apiKey, token, localApp)
      await outputUpdateURLsResult(shouldUpdateURLs, newURLs, remoteApp, localApp)
    }
  }
  return shouldUpdateURLs
}

async function setupNetworkingOptions(
  webs: Web[],
  apiKey: string,
  token: string,
  frontEndOptions: Pick<FrontendURLOptions, 'noTunnel' | 'tunnelUrl' | 'commandConfig'>,
  tunnelClient?: TunnelClient,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)

  await validateCustomPorts(webs)

  // generateFrontendURL still uses the old naming of frontendUrl and frontendPort,
  // we can rename them to proxyUrl and proxyPort when we delete dev.ts
  const [{frontendUrl, frontendPort: proxyPort, usingLocalhost}, backendPort, currentUrls] = await Promise.all([
    generateFrontendURL({
      ...frontEndOptions,
      tunnelClient,
    }),
    getBackendPort() || backendConfig?.configuration.port || getAvailableTCPPort(),
    getURLs(apiKey, token),
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
  const token = config.token
  const app = {
    canEnablePreviewMode: await canEnablePreviewMode({
      remoteApp: config.remoteApp,
      localApp: config.localApp,
      token,
      apiKey,
    }),
    developmentStorePreviewEnabled: config.remoteApp.developmentStorePreviewEnabled,
    apiKey,
    token,
  }

  return renderDev({
    processes: processesForTaskRunner,
    previewUrl,
    graphiqlUrl,
    app,
    abortController,
    developerPreview: developerPreviewController(apiKey, token),
  })
}

export function developerPreviewController(apiKey: string, originalToken: string): DeveloperPreviewController {
  let currentToken = originalToken

  const refreshToken = async () => {
    const newToken = await ensureAuthenticatedPartners([], process.env, {noPrompt: true})
    if (newToken) currentToken = newToken
  }

  const withRefreshToken = async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
    try {
      const result = await fn(currentToken)
      return result
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_err) {
      try {
        await refreshToken()
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_err) {
        outputDebug('Failed to refresh token')
        // Swallow the error, this isn't important enough to crash the process
      }
      return fn(currentToken)
      // If it fails after refresh, let it crash the process
    }
  }

  return {
    fetchMode: async () => withRefreshToken(async (token: string) => Boolean(await fetchAppPreviewMode(apiKey, token))),
    enable: async () =>
      withRefreshToken(async (token: string) => {
        await enableDeveloperPreview({apiKey, token})
      }),
    disable: async () =>
      withRefreshToken(async (token: string) => {
        await disableDeveloperPreview({apiKey, token})
      }),
    update: async (state: boolean) =>
      withRefreshToken(async (token: string) => developerPreviewUpdate({apiKey, token, enabled: state})),
  }
}

export async function logMetadataForDev(options: {
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
    cmd_app_reset_used: options.devOptions.reset,
  }))

  await metadata.addSensitiveMetadata(() => ({
    store_fqdn: options.storeFqdn,
    cmd_dev_tunnel_custom: tunnelType === 'custom' ? options.tunnelUrl : undefined,
  }))
}

export function scopesMessage(scopes: string[]) {
  return {
    list: {
      items: scopes.length === 0 ? ['No scopes'] : scopes,
    },
  }
}

export async function validateCustomPorts(webConfigs: Web[]) {
  const allPorts = webConfigs.map((config) => config.configuration.port).filter((port) => port)
  const duplicatedPort = allPorts.find((port, index) => allPorts.indexOf(port) !== index)
  if (duplicatedPort) {
    throw new AbortError(`Found port ${duplicatedPort} for multiple webs.`, 'Please define a unique port for each web.')
  }
  await Promise.all(
    allPorts.map(async (port) => {
      const portAvailable = await checkPortAvailability(port!)
      if (!portAvailable) {
        throw new AbortError(`Hard-coded port ${port} is not available, please choose a different one.`)
      }
    }),
  )
}

export function setPreviousAppId(directory: string, apiKey: string) {
  setCachedAppInfo({directory, previousAppId: apiKey})
}
