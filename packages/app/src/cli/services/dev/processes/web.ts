import {BaseProcess} from './types.js'
import {frontAndBackendConfig} from './utils.js'
import {LaunchWebOptions, launchWebProcess} from '../../dev.js'
import {Web, WebType} from '../../../models/app/app.js'
import {isWebType} from '../../../models/app/loader.js'
import {isSpinEnvironment, spinFqdn} from '@shopify/cli-kit/node/context/spin'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'

export interface WebProcess extends BaseProcess<LaunchWebOptions> {
  type: 'web'
}

export async function setupWebProcesses({
  webs,
  frontendUrl,
  exposedUrl,
  frontendPort,
  backendPort,
  usingLocalhost,
  apiKey,
  apiSecret,
  frontendServerPort,
  scopes,
}: {
  webs: Web[]
  frontendUrl: string
  exposedUrl: string
  frontendPort: number
  backendPort: number
  usingLocalhost: boolean
  apiKey: string
  apiSecret: string
  frontendServerPort: number | undefined
  scopes: string
}): Promise<WebProcess[]> {
  const {frontendConfig} = frontAndBackendConfig(webs)

  const hmrServerPort = frontendConfig?.configuration.hmr_server ? await getAvailableTCPPort() : undefined
  const shopCustomDomain = isSpinEnvironment() ? `shopify.${await spinFqdn()}` : undefined

  const webProcessSetups = webs.map(async (web) => {
    const isFrontend = isWebType(web, WebType.Frontend)
    const hostname = isFrontend ? frontendUrl : exposedUrl

    let port
    if (isFrontend || usingLocalhost) {
      port = frontendPort
    } else if (isWebType(web, WebType.Backend)) {
      port = backendPort
    } else {
      port = await getAvailableTCPPort()
    }

    const hmrServerOptions =
      hmrServerPort && web.configuration.roles.includes(WebType.Frontend)
        ? {
            port: hmrServerPort,
            httpPaths: web.configuration.hmr_server!.http_paths,
          }
        : undefined

    return {
      type: 'web',
      prefix: web.configuration.name ?? ['web', ...web.configuration.roles].join('-'),
      function: launchWebProcess,
      options: {
        port: port ?? -1,
        portFromConfig: web.configuration.port,
        apiKey,
        apiSecret,
        hostname,
        backendPort,
        frontendServerPort,
        directory: web.directory,
        devCommand: web.configuration.commands.dev,
        scopes,
        shopCustomDomain,
        hmrServerOptions,
      },
    } as WebProcess
  })
  return Promise.all(webProcessSetups)
}
