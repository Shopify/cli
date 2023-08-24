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
  proxyUrl,
  frontendPort,
  backendPort,
  apiKey,
  apiSecret,
  scopes,
}: {
  webs: Web[]
  proxyUrl: string
  frontendPort: number
  backendPort: number
  apiKey: string
  apiSecret: string
  scopes: string
}): Promise<WebProcess[]> {
  const {frontendConfig} = frontAndBackendConfig(webs)

  const hmrServerPort = frontendConfig?.configuration.hmr_server ? await getAvailableTCPPort() : undefined
  const shopCustomDomain = isSpinEnvironment() ? `shopify.${await spinFqdn()}` : undefined

  const webProcessSetups = webs.map(async (web) => {
    const port = await getWebProcessPort({web, frontendPort, backendPort})

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
        port,
        portFromConfig: web.configuration.port,
        apiKey,
        apiSecret,
        hostname: proxyUrl,
        backendPort,
        // when we delete `dev.ts` we can rename frontendServerPort to frontendPort
        frontendServerPort: frontendPort,
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

async function getWebProcessPort({
  web,
  frontendPort,
  backendPort,
}: {
  web: Web
  frontendPort: number
  backendPort: number
}): Promise<number> {
  if (isWebType(web, WebType.Frontend)) {
    return frontendPort
  } else if (isWebType(web, WebType.Backend)) {
    return backendPort
  } else {
    return getAvailableTCPPort()
  }
}
