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
import {DevOptions, logMetadataForDev, scopesMessage, setPreviousAppId, validateCustomPorts} from './dev.js'
import {ensureDevContext} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {installAppDependencies} from './dependencies.js'
import {DevConfig, DevProcesses, setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {frontAndBackendConfig} from './dev/processes/utils.js'
import {outputUpdateURLsResult, renderDev} from './dev/ui.js'
import {DevProcessFunction} from './dev/processes/types.js'
import {canEnablePreviewMode} from './extensions/common.js'
import {loadApp} from '../models/app/loader.js'
import {Web, isCurrentAppSchema, getAppScopesArray, AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {OrganizationApp} from '../models/organization.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {getBackendPort} from '@shopify/cli-kit/node/environment'
import {basename} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {OutputProcess} from '@shopify/cli-kit/node/output'

export async function dev(commandOptions: DevOptions) {
  renderWarning({body: 'Running in new dev mode!'})
  const config = await prepareForDev(commandOptions)

  await actionsBeforeSettingUpDevProcesses(config)

  const {processes, previewUrl} = await setupDevProcesses(config)

  await actionsBeforeLaunchingDev(config)

  await runDevProcesses({processes, previewUrl, config})
}

async function prepareForDev(commandOptions: DevOptions): Promise<DevConfig> {
  // Be optimistic about tunnel creation and do it as early as possible
  const tunnelPort = await getAvailableTCPPort()

  let tunnelClient: TunnelClient | undefined
  if (!commandOptions.tunnelUrl && !commandOptions.noTunnel) {
    tunnelClient = await startTunnelPlugin(commandOptions.commandConfig, tunnelPort, 'cloudflare')
  }

  const token = await ensureAuthenticatedPartners()
  const {
    storeFqdn,
    remoteApp,
    remoteAppUpdated,
    updateURLs: cachedUpdateURLs,
    configName,
  } = await ensureDevContext(commandOptions, token)

  const apiKey = remoteApp.apiKey
  const usesUnifiedDeployment = remoteApp?.betas?.unifiedAppDeployment ?? false

  const specifications = await fetchSpecifications({token, apiKey, config: commandOptions.commandConfig})

  let localApp = await loadApp({directory: commandOptions.directory, specifications, configName})

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
    remoteApp,
    remoteAppUpdated,
    localApp,
    token,
    commandOptions,
    network,
    partnerUrlsUpdated,
    usesUnifiedDeployment,
  }
}

async function actionsBeforeSettingUpDevProcesses({localApp, remoteApp}: DevConfig) {
  if (
    isCurrentAppSchema(localApp.configuration) &&
    !localApp.configuration.access_scopes?.use_legacy_install_flow &&
    getAppScopesArray(localApp.configuration).sort().join(',') !== remoteApp.requestedAccessScopes?.sort().join(',')
  ) {
    const nextSteps = [['Run', {command: 'shopify app config push'}, 'to push your scopes to the Partner Dashboard']]

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

async function actionsBeforeLaunchingDev(config: DevConfig) {
  setPreviousAppId(config.commandOptions.directory, config.remoteApp.apiKey)

  await logMetadataForDev({
    devOptions: config.commandOptions,
    tunnelUrl: config.network.frontendUrl,
    shouldUpdateURLs: config.partnerUrlsUpdated,
    storeFqdn: config.storeFqdn,
    deploymentMode: config.usesUnifiedDeployment ? 'unified' : 'legacy',
  })

  await reportAnalyticsEvent({config: config.commandOptions.commandConfig})
}

function getDevUUIDsForAllExtensions(localApp: AppInterface, apiKey: string) {
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})
  const envExtensionsIds = prodEnvIdentifiers.extensions || {}
  const extensionsIds = prodEnvIdentifiers.app === apiKey ? envExtensionsIds : {}

  const allExtensionsWithDevUUIDs = localApp.allExtensions.map((ext) => {
    ext.devUUID = extensionsIds[ext.localIdentifier] ?? ext.devUUID
    return ext
  })
  return allExtensionsWithDevUUIDs
}

async function handleUpdatingOfPartnerUrls(
  webs: Web[],
  commandSpecifiedToUpdate: boolean,
  network: {
    exposedUrl: string
    currentUrls: PartnersURLs
  },
  localApp: AppInterface,
  cachedUpdateURLs: boolean | undefined,
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string | undefined},
  apiKey: string,
  token: string,
) {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)
  let partnerUrlsUpdated = false
  if (frontendConfig || backendConfig) {
    if (commandSpecifiedToUpdate) {
      const newURLs = generatePartnersURLs(
        network.exposedUrl,
        webs.map(({configuration}) => configuration.auth_callback_path).find((path) => path),
      )
      partnerUrlsUpdated = await shouldOrPromptUpdateURLs({
        currentURLs: network.currentUrls,
        appDirectory: localApp.directory,
        cachedUpdateURLs,
        newApp: remoteApp.newApp,
        localApp,
        apiKey,
      })
      if (partnerUrlsUpdated) await updateURLs(newURLs, apiKey, token, localApp)
      await outputUpdateURLsResult(partnerUrlsUpdated, newURLs, remoteApp, localApp)
    }
  }
  return partnerUrlsUpdated
}

async function setupNetworkingOptions(
  webs: Web[],
  apiKey: string,
  token: string,
  frontEndOptions: Pick<FrontendURLOptions, 'noTunnel' | 'tunnelUrl' | 'commandConfig'>,
  tunnelClient?: TunnelClient,
) {
  const {backendConfig, frontendConfig: baseFrontendConfig} = frontAndBackendConfig(webs)

  await validateCustomPorts(webs)

  const [{frontendUrl, frontendPort, usingLocalhost}, backendPort, currentUrls] = await Promise.all([
    generateFrontendURL({
      ...frontEndOptions,
      tunnelClient,
    }),
    getBackendPort() || backendConfig?.configuration.port || getAvailableTCPPort(),
    getURLs(apiKey, token),
  ])

  const exposedUrl = usingLocalhost ? `${frontendUrl}:${frontendPort}` : frontendUrl
  const proxyPort = usingLocalhost ? await getAvailableTCPPort() : frontendPort
  const proxyUrl = usingLocalhost ? `${frontendUrl}:${proxyPort}` : frontendUrl

  const frontendConfig = baseFrontendConfig
  let frontendServerPort = frontendConfig?.configuration.port
  if (frontendConfig) {
    if (!frontendServerPort) {
      frontendServerPort = frontendConfig === backendConfig ? backendPort : await getAvailableTCPPort()
    }
    frontendConfig.configuration.port = frontendServerPort
  }

  return {
    backendPort,
    frontendPort,
    webs,
    frontendUrl,
    usingLocalhost,
    exposedUrl,
    frontendServerPort,
    proxyPort,
    proxyUrl,
    currentUrls,
  }
}

async function runDevProcesses({
  processes,
  previewUrl,
  config,
}: {
  processes: DevProcesses
  previewUrl: string
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

  const app = {
    canEnablePreviewMode: canEnablePreviewMode(config.remoteApp, config.localApp),
    developmentStorePreviewEnabled: config.remoteApp.developmentStorePreviewEnabled,
    apiKey: config.remoteApp.apiKey,
    token: config.token,
  }

  return renderDev({
    processes: processesForTaskRunner,
    previewUrl,
    app,
    abortController,
  })
}
