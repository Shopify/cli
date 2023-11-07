import {BaseProcess, DevProcessFunction} from './types.js'
import {PreviewThemeAppExtensionsProcess, setupPreviewThemeAppExtensionsProcess} from './theme-app-extension.js'
import {PreviewableExtensionProcess, setupPreviewableExtensionsProcess} from './previewable-extension.js'
import {DraftableExtensionProcess, setupDraftableExtensionsProcess} from './draftable-extension.js'
import {SendWebhookProcess, setupSendUninstallWebhookProcess} from './uninstall-webhook.js'
import {GraphiQLServerProcess, setupGraphiQLServerProcess} from './graphiql.js'
import {WebProcess, setupWebProcesses} from './web.js'
import {environmentVariableNames, urlNamespaces} from '../../../constants.js'
import {AppInterface, getAppScopes} from '../../../models/app/app.js'

import {OrganizationApp} from '../../../models/organization.js'
import {DevOptions} from '../../dev.js'
import {getProxyingWebServer} from '../../../utilities/app/http-reverse-proxy.js'
import {buildAppURLForWeb} from '../../../utilities/app/app-url.js'
import {PartnersURLs} from '../urls.js'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'

export interface ProxyServerProcess extends BaseProcess<{port: number; rules: {[key: string]: string}}> {
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

export type DevProcesses = DevProcessDefinition[]

interface DevNetworkOptions {
  proxyPort: number
  proxyUrl: string
  frontendPort: number
  backendPort: number
  currentUrls: PartnersURLs
}

export interface DevConfig {
  localApp: AppInterface
  remoteAppUpdated: boolean
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {
    apiSecret?: string | undefined
  }
  token: string
  storeFqdn: string
  storeId: string
  commandOptions: DevOptions
  network: DevNetworkOptions
  partnerUrlsUpdated: boolean
}

export async function setupDevProcesses({
  localApp,
  remoteAppUpdated,
  token,
  remoteApp,
  storeFqdn,
  storeId,
  commandOptions,
  network,
}: DevConfig): Promise<{
  processes: DevProcesses
  previewUrl: string
  graphiqlUrl: string | undefined
}> {
  const apiKey = remoteApp.apiKey
  const apiSecret = (remoteApp.apiSecret as string) ?? ''
  const appPreviewUrl = buildAppURLForWeb(storeFqdn, apiKey)
  const shouldRenderGraphiQL =
    isUnitTest() || (await isShopify()) || isTruthy(process.env[environmentVariableNames.enableGraphiQLExplorer])

  const processes = [
    ...(await setupWebProcesses({
      webs: localApp.webs,
      proxyUrl: network.proxyUrl,
      frontendPort: network.frontendPort,
      backendPort: network.backendPort,
      apiKey,
      apiSecret,
      scopes: getAppScopes(localApp.configuration),
    })),
    shouldRenderGraphiQL
      ? await setupGraphiQLServerProcess({
          appName: localApp.name,
          appUrl: appPreviewUrl,
          apiKey,
          apiSecret,
          storeFqdn,
          url: network.proxyUrl.replace(/^https?:\/\//, ''),
        })
      : undefined,
    await setupPreviewableExtensionsProcess({
      allExtensions: localApp.allExtensions,
      storeFqdn,
      storeId,
      apiKey,
      subscriptionProductUrl: commandOptions.subscriptionProductUrl,
      checkoutCartUrl: commandOptions.checkoutCartUrl,
      proxyUrl: network.proxyUrl,
      appName: localApp.name,
      appDotEnvFile: localApp.dotenv,
      grantedScopes: remoteApp.grantedScopes,
      appId: remoteApp.id,
      appDirectory: localApp.directory,
    }),
    await setupDraftableExtensionsProcess({
      localApp,
      remoteApp,
      apiKey,
      token,
      proxyUrl: network.proxyUrl,
    }),
    await setupPreviewThemeAppExtensionsProcess({
      allExtensions: localApp.allExtensions,
      storeFqdn,
      apiKey,
      token,
      theme: commandOptions.theme,
      themeExtensionPort: commandOptions.themeExtensionPort,
      notify: commandOptions.notify,
    }),
    setupSendUninstallWebhookProcess({
      webs: localApp.webs,
      backendPort: network.backendPort,
      frontendPort: network.frontendPort,
      token,
      storeFqdn,
      apiSecret,
      remoteAppUpdated,
    }),
  ].filter(stripUndefineds)

  // Add http server proxy & configure ports, for processes that need it
  const processesWithProxy = await setPortsAndAddProxyProcess(processes, network.proxyPort)

  // Decide on the appropriate preview URL for a session with these processes
  const anyPreviewableExtensions = processesWithProxy.filter((process) => process.type === 'previewable-extension')
  const previewUrl = anyPreviewableExtensions.length > 0 ? `${network.proxyUrl}/extensions/dev-console` : appPreviewUrl

  return {
    processes: processesWithProxy,
    previewUrl,
    graphiqlUrl: shouldRenderGraphiQL ? `${network.proxyUrl}/${urlNamespaces.devTools}/graphiql` : undefined,
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

      if (process.type === 'web') {
        const targetPort = process.options.portFromConfig || process.options.port
        rules.default = `http://localhost:${targetPort}`
        const hmrServer = process.options.hmrServerOptions
        if (hmrServer) {
          rules.websocket = `http://localhost:${hmrServer.port}`
          hmrServer.httpPaths.forEach((path) => (rules[path] = `http://localhost:${hmrServer.port}`))
        }
        process.options.port = targetPort
      } else if (process.type === 'previewable-extension') {
        const targetPort = await getAvailableTCPPort()
        rules[process.options.pathPrefix] = `http://localhost:${targetPort}`
        process.options.port = targetPort
      } else if (process.type === 'graphiql') {
        const targetPort = await getAvailableTCPPort()
        rules[process.urlPrefix] = `http://localhost:${targetPort}`
        process.options.port = targetPort
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
