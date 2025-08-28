import {BaseProcess} from './types.js'
import {frontAndBackendConfig} from './utils.js'
import {Web, WebType} from '../../../models/app/app.js'
import {isWebType} from '../../../models/app/loader.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {exec} from '@shopify/cli-kit/node/system'
import {isVerbose} from '@shopify/cli-kit/node/context/local'
import {Writable} from 'stream'

interface LaunchWebOptions {
  port: number
  apiKey: string
  apiSecret?: string
  hostname?: string
  backendPort: number
  frontendServerPort?: number
  directory: string
  devCommand: string
  preDevCommand?: string
  scopes?: string
  shopCustomDomain?: string
  hmrServerOptions?: {port: number; httpPaths: string[]}
  portFromConfig?: number
  roles: WebType[]
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
  const shopCustomDomain = undefined

  const webProcessSetups = webs.map(async (web) => {
    const port = await getWebProcessPort({web, frontendPort, backendPort})

    const hmrServerOptions =
      hmrServerPort && web.configuration.roles.includes(WebType.Frontend)
        ? {
            port: hmrServerPort,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            httpPaths: web.configuration.hmr_server!.http_paths,
          }
        : undefined

    const process: WebProcess = {
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
        preDevCommand: web.configuration.commands.predev,
        scopes,
        shopCustomDomain,
        hmrServerOptions,
        roles: web.configuration.roles,
      },
    }
    return process
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
  {stdout, stderr, abortSignal: signal}: {stdout: Writable; stderr: Writable; abortSignal: AbortSignal},
  {
    port,
    apiKey,
    apiSecret,
    hostname,
    backendPort,
    frontendServerPort,
    directory,
    devCommand,
    preDevCommand,
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

  const baseCommandRunConfig = {signal, directory, port, env, stdout, stderr}

  // Support for multiple sequential commands: `echo "hello" && echo "world"`
  // Pre-dev commands are run before the dev command, but without any output
  if (preDevCommand) {
    stdout.write(`Running pre-dev command: "${preDevCommand}"`)
    await runCommands({...baseCommandRunConfig, command: preDevCommand, showOutput: isVerbose()})
  }
  await runCommands({...baseCommandRunConfig, command: devCommand, showOutput: true})
}

interface RunArrayOfCommandsOptions {
  command: string
  signal: AbortSignal
  directory: string
  port: number
  showOutput: boolean
  env: {[key: string]: string | undefined}
  stdout?: Writable
  stderr?: Writable
}

async function runCommands({
  command,
  signal,
  directory,
  port,
  env,
  showOutput,
  stdout,
  stderr,
}: RunArrayOfCommandsOptions) {
  const commands = command.split('&&').map((cmd) => cmd.trim()) ?? []
  for (const command of commands) {
    const [cmd, ...args] = command.split(' ')
    if (cmd?.length === 0) continue
    // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-non-null-assertion
    await exec(cmd!, args, {
      cwd: directory,
      stdout: showOutput ? stdout : undefined,
      stderr,
      signal,
      env: {
        ...env,
        PORT: `${port}`,
        // Note: These are Laravel variables for backwards compatibility with 2.0 templates.
        SERVER_PORT: `${port}`,
      },
    })
  }
}
