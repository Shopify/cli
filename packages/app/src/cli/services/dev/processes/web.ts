import {BaseProcess} from './types.js'
import {frontAndBackendConfig} from './utils.js'
import {Web, WebType} from '../../../models/app/app.js'
import {isWebType} from '../../../models/app/loader.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {isSpinEnvironment, spinFqdn} from '@shopify/cli-kit/node/context/spin'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {exec} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

export interface LaunchWebOptions {
  port: number
  apiKey: string
  apiSecret?: string
  hostname?: string
  backendPort: number
  frontendServerPort?: number
  directory: string
  devCommand: string
  scopes?: string
  shopCustomDomain?: string
  hmrServerOptions?: {port: number; httpPaths: string[]}
  portFromConfig?: number
}

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

export async function launchWebProcess(
  {stdout, stderr, abortSignal}: {stdout: Writable; stderr: Writable; abortSignal: AbortSignal},
  {
    port,
    apiKey,
    apiSecret,
    hostname,
    backendPort,
    frontendServerPort,
    directory,
    devCommand,
    scopes,
    shopCustomDomain,
    hmrServerOptions,
  }: LaunchWebOptions,
) {
  const hmrServerPort = hmrServerOptions?.port

  const env = {
    SHOPIFY_API_KEY: apiKey,
    SHOPIFY_API_SECRET: apiSecret,
    HOST: hostname,
    SCOPES: scopes,
    NODE_ENV: `development`,
    ...(shopCustomDomain && {
      SHOP_CUSTOM_DOMAIN: shopCustomDomain,
    }),
    BACKEND_PORT: `${backendPort}`,
    FRONTEND_PORT: `${frontendServerPort}`,
    ...(hmrServerPort && {
      HMR_SERVER_PORT: `${hmrServerPort}`,
    }),
    APP_URL: hostname,
    APP_ENV: 'development',
    // Note: These are Remix-specific variables
    REMIX_DEV_ORIGIN: hostname,
  }

  // Support for multiple sequential commands: `echo "hello" && echo "world"`
  const devCommands = devCommand.split('&&').map((cmd) => cmd.trim()) ?? []
  for (const command of devCommands) {
    const [cmd, ...args] = command.split(' ')
    // eslint-disable-next-line no-await-in-loop
    await exec(cmd!, args, {
      cwd: directory,
      stdout,
      stderr,
      signal: abortSignal,
      env: {
        ...env,
        PORT: `${port}`,
        // Note: These are Laravel variables for backwards compatibility with 2.0 templates.
        SERVER_PORT: `${port}`,
      },
    })
  }
}
