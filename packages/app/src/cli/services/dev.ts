import {ensureDevEnvironment} from './environment'
import {generateURL, updateURLs} from './dev/urls'
import {installAppDependencies} from './dependencies'
import {devExtensions} from './dev/extension'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy'
import {App, AppConfiguration, Web, WebType} from '../models/app/app'
import {error, output, port, system} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'
import {Writable} from 'node:stream'

export interface DevOptions {
  app: App
  apiKey?: string
  store?: string
  reset: boolean
  update: boolean
  plugins: Plugin[]
  skipDependenciesInstallation: boolean
}

interface DevWebOptions {
  backendPort: number
  apiKey: string
  apiSecret?: string
  hostname?: string
  scopes?: AppConfiguration['scopes']
}

async function dev(options: DevOptions) {
  if (!options.skipDependenciesInstallation) {
    // eslint-disable-next-line no-param-reassign
    options = {
      ...options,
      app: await installAppDependencies(options.app),
    }
  }
  const {
    identifiers,
    store,
    app: {apiSecret},
  } = await ensureDevEnvironment(options)

  const frontendPort = await port.getRandomPort()
  const backendPort = await port.getRandomPort()
  const url: string = await generateURL(options, frontendPort)
  let updateMessage = ''
  if (options.update) {
    await updateURLs(identifiers.app, url)
    updateMessage = `\nYour app's URLs in Shopify Partners have been updated. `
  }
  const message = `${updateMessage}Preview link for viewing or sharing: `
  const storeAppUrl = `${url}/api/auth?shop=${store}`
  output.info(output.content`${message}${output.token.link(storeAppUrl, storeAppUrl)}\n`)

  const frontendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Frontend)!
  const backendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Backend)!

  const backendOptions = {
    apiKey: identifiers.app,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: (apiSecret as string) ?? '',
    hostname: url,
  }

  const devFront = devFrontendTarget(frontendConfig, identifiers.app, backendPort)
  const devBack = devBackendTarget(backendConfig, backendOptions)
  const devExt = await devExtensionsTarget(options.app, identifiers.app, url, store)

  await runConcurrentHTTPProcessesAndPathForwardTraffic(url, frontendPort, [devExt, devFront], [devBack])
}

function devFrontendTarget(web: Web, apiKey: string, backendPort: number): ReverseHTTPProxyTarget {
  const {commands} = web.configuration
  const [cmd, ...args] = commands.dev.split(' ')
  const env = {
    SHOPIFY_API_KEY: apiKey,
    BACKEND_PORT: `${backendPort}`,
    NODE_ENV: `development`,
  }

  return {
    logPrefix: web.configuration.type,
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => {
      await system.exec(cmd, args, {
        cwd: web.directory,
        stdout,
        stderr,
        env: {
          ...process.env,
          ...env,
          FRONTEND_PORT: `${port}`,
        },
      })
    },
  }
}

function devBackendTarget(web: Web, options: DevWebOptions): output.OutputProcess {
  const {commands} = web.configuration
  const [cmd, ...args] = commands.dev.split(' ')
  const env = {
    SHOPIFY_API_KEY: options.apiKey,
    SHOPIFY_API_SECRET: options.apiSecret,
    HOST: options.hostname,
    BACKEND_PORT: `${options.backendPort}`,
    SCOPES: options.scopes,
    NODE_ENV: `development`,
  }

  return {
    prefix: web.configuration.type,
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
      await system.exec(cmd, args, {
        cwd: web.directory,
        stdout,
        stderr,
        env: {
          ...process.env,
          ...env,
        },
      })
    },
  }
}

async function devExtensionsTarget(
  app: App,
  apiKey: string,
  url: string,
  storeFqdn: string,
): Promise<ReverseHTTPProxyTarget> {
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => {
      await devExtensions({app, extensions: app.extensions.ui, stdout, stderr, signal, url, port, storeFqdn, apiKey})
    },
  }
}

export default dev
