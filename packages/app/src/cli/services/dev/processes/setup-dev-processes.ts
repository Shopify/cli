import {BaseProcess, DevProcessFunction} from './types.js'
import {PreviewThemeAppExtensionsProcess, setupPreviewThemeAppExtensionsProcess} from './theme-app-extension.js'
import {PreviewableExtensionProcess, setupPreviewableExtensionsProcess} from './previewable-extension.js'
import {DraftableExtensionProcess, setupDraftableExtensionsProcess} from './draftable-extension.js'
import {SendWebhookProcess, setupSendUninstallWebhookProcess} from './uninstall-webhook.js'
import {GraphiQLServerProcess, setupGraphiQLServerProcess} from './graphiql.js'
import {WebProcess, setupWebProcesses} from './web.js'
import {DevSessionProcess, setupDevSessionProcess} from './dev-session.js'
import {AppLogsSubscribeProcess, setupAppLogsPollingProcess} from './app-logs-polling.js'
import {AppWatcherProcess, setupAppWatcherProcess} from './app-watcher-process.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {environmentVariableNames} from '../../../constants.js'
import {AppLinkedInterface, getAppScopes, WebType} from '../../../models/app/app.js'

import {OrganizationApp} from '../../../models/organization.js'
import {DevOptions} from '../../dev.js'
import {getProxyingWebServer} from '../../../utilities/app/http-reverse-proxy.js'
import {buildAppURLForWeb} from '../../../utilities/app/app-url.js'
import {ApplicationURLs} from '../urls.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {reloadApp} from '../../../models/app/loader.js'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {getEnvironmentVariables} from '@shopify/cli-kit/node/environment'

interface ProxyServerProcess extends BaseProcess<{port: number; rules: {[key: string]: string}}> {
  type: 'proxy-server'
}

type DevProcessDefinition =
  | SendWebhookProcess
  | PreviewThemeAppExtensionsProcess
  | WebProcess
  | ProxyServerProcess
  | PreviewableExtensionProcess
  | DraftableExtensionProcess
  | GraphiQLServerProcess
  | DevSessionProcess
  | AppLogsSubscribeProcess
  | AppWatcherProcess

export type DevProcesses = DevProcessDefinition[]

interface DevNetworkOptions {
  proxyPort: number
  proxyUrl: string
  frontendPort: number
  backendPort: number
  currentUrls: ApplicationURLs
}

export interface DevConfig {
  localApp: AppLinkedInterface
  remoteAppUpdated: boolean
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  storeId: string
  commandOptions: DevOptions
  network: DevNetworkOptions
  partnerUrlsUpdated: boolean
  graphiqlPort: number
  graphiqlKey?: string
  previewableExtensionPort: number
}

export async function setupDevProcesses({
  localApp,
  remoteAppUpdated,
  developerPlatformClient,
  remoteApp,
  storeFqdn,
  storeId,
  commandOptions,
  network,
  graphiqlPort,
  graphiqlKey,
  previewableExtensionPort,
}: DevConfig): Promise<{
  processes: DevProcesses
  previewUrl: string
  graphiqlUrl: string | undefined
  devSessionStatusManager: DevSessionStatusManager
}> {
  const apiKey = remoteApp.apiKey
  const apiSecret = remoteApp.apiSecretKeys[0]?.secret ?? ''
  const appPreviewUrl = await buildAppURLForWeb(storeFqdn, apiKey)
  const env = getEnvironmentVariables()
  const shouldRenderGraphiQL = !isTruthy(env[environmentVariableNames.disableGraphiQLExplorer])
  const shouldPerformAppLogPolling = localApp.allExtensions.some((extension) => extension.isFunctionExtension)

  // At this point, the toml file has changed, we need to reload the app before actually starting dev
  const reloadedApp = await reloadApp(localApp)
  const appWatcher = new AppEventWatcher(reloadedApp, network.proxyUrl)

  // Decide on the appropriate preview URL for a session with these processes
  const anyPreviewableExtensions = reloadedApp.allExtensions.some((ext) => ext.isPreviewable)
  const devConsoleURL = `${network.proxyUrl}/extensions/dev-console`
  const previewURL = anyPreviewableExtensions ? devConsoleURL : appPreviewUrl

  const graphiqlURL = shouldRenderGraphiQL
    ? `http://localhost:${graphiqlPort}/graphiql${graphiqlKey ? `?key=${graphiqlKey}` : ''}`
    : undefined

  const devSessionStatusManager = new DevSessionStatusManager({isReady: false, previewURL, graphiqlURL})

  const processes = [
    ...(await setupWebProcesses({
      webs: reloadedApp.webs,
      proxyUrl: network.proxyUrl,
      frontendPort: network.frontendPort,
      backendPort: network.backendPort,
      apiKey,
      apiSecret,
      scopes: getAppScopes(reloadedApp.configuration),
    })),
    shouldRenderGraphiQL
      ? await setupGraphiQLServerProcess({
          appName: remoteApp.title,
          appUrl: appPreviewUrl,
          port: graphiqlPort,
          apiKey,
          apiSecret,
          key: graphiqlKey,
          storeFqdn,
        })
      : undefined,
    await setupPreviewableExtensionsProcess({
      allExtensions: reloadedApp.allExtensions,
      storeFqdn,
      storeId,
      apiKey,
      subscriptionProductUrl: commandOptions.subscriptionProductUrl,
      checkoutCartUrl: commandOptions.checkoutCartUrl,
      proxyUrl: network.proxyUrl,
      appName: reloadedApp.name,
      appDotEnvFile: reloadedApp.dotenv,
      grantedScopes: remoteApp.grantedScopes,
      appId: remoteApp.id,
      appDirectory: reloadedApp.directory,
      appWatcher,
      port: previewableExtensionPort,
    }),
    developerPlatformClient.supportsDevSessions
      ? await setupDevSessionProcess({
          app: reloadedApp,
          apiKey,
          developerPlatformClient,
          url: network.proxyUrl,
          appId: remoteApp.id,
          organizationId: remoteApp.organizationId,
          storeFqdn,
          appWatcher,
          appPreviewURL: appPreviewUrl,
          appLocalProxyURL: devConsoleURL,
          devSessionStatusManager,
        })
      : await setupDraftableExtensionsProcess({
          localApp: reloadedApp,
          remoteApp,
          apiKey,
          developerPlatformClient,
          proxyUrl: network.proxyUrl,
          appWatcher,
        }),
    await setupPreviewThemeAppExtensionsProcess({
      remoteApp,
      localApp: reloadedApp,
      storeFqdn,
      theme: commandOptions.theme,
      themeExtensionPort: commandOptions.themeExtensionPort,
    }),
    setupSendUninstallWebhookProcess({
      webs: reloadedApp.webs,
      backendPort: network.backendPort,
      frontendPort: network.frontendPort,
      organizationId: remoteApp.organizationId,
      developerPlatformClient,
      storeFqdn,
      apiSecret,
      remoteAppUpdated,
    }),
    shouldPerformAppLogPolling
      ? await setupAppLogsPollingProcess({
          developerPlatformClient,
          subscription: {
            shopIds: [storeId],
            apiKey,
          },
          storeName: storeFqdn,
        })
      : undefined,
    await setupAppWatcherProcess({
      appWatcher,
    }),
  ].filter(stripUndefineds)

  // Add http server proxy & configure ports, for processes that need it
  const processesWithProxy = await setPortsAndAddProxyProcess(processes, network.proxyPort)

  return {
    processes: processesWithProxy,
    previewUrl: previewURL,
    graphiqlUrl: graphiqlURL,
    devSessionStatusManager,
  }
}

const stripUndefineds = <T>(process: T | undefined | false): process is T => {
  return process !== undefined && process !== false
}

async function setPortsAndAddProxyProcess(processes: DevProcesses, proxyPort: number): Promise<DevProcesses> {
  // Convert processes that use proxying to have a port number and register their mapping rules
  const processesAndRules = await Promise.all(
    processes.map(async (process) => {
      const rules: {[key: string]: string} = {}

      if (process.type === 'web' && process.options.roles.includes(WebType.Frontend)) {
        const targetPort = process.options.portFromConfig || process.options.port
        rules.default = `http://localhost:${targetPort}`
        const hmrServer = process.options.hmrServerOptions
        if (hmrServer) {
          rules.websocket = `http://localhost:${hmrServer.port}`
          hmrServer.httpPaths.forEach((path) => (rules[path] = `http://localhost:${hmrServer.port}`))
        }
        process.options.port = targetPort
      } else if (process.type === 'previewable-extension') {
        rules[process.options.pathPrefix] = `http://localhost:${process.options.port}`
      }

      return {process, rules}
    }),
  )

  const newProcesses = processesAndRules.map(({process}) => process)
  const allRules = processesAndRules.map(({rules}) => rules).reduce((acc, rules) => ({...acc, ...rules}), {})

  if (Object.keys(allRules).length > 0) {
    newProcesses.push({
      type: 'proxy-server',
      prefix: 'proxy',
      function: startProxyServer,
      options: {
        port: proxyPort,
        rules: allRules,
      },
    })
  }

  return newProcesses
}

export const startProxyServer: DevProcessFunction<{port: number; rules: {[key: string]: string}}> = async (
  {abortSignal},
  {port, rules},
) => {
  const {server} = await getProxyingWebServer(rules, abortSignal)
  await server.listen(port)
}
