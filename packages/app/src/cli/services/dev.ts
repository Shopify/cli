import {ensureDevEnvironment} from './environment'
import {generateURL, updateURLs} from './dev/urls'
import {installAppDependencies} from './dependencies'
import {serveExtensions} from './build/extension'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy'
import {App, AppConfiguration, Web, WebType} from '../models/app/app'
import {output, port, system} from '@shopify/cli-kit'
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
  frontendPort: number
  backendPort: number
  apiKey: string
  apiSecret: string
  hostname: string
  scopes: AppConfiguration['scopes']
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

  const devFront = devFrontend(frontendConfig, {
    apiKey: identifiers.app,
    frontendPort,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: apiSecret as string,
    hostname: url,
  })

  const devBack: output.OutputProcess = devBackend(backendConfig, {
    apiKey: identifiers.app.apiKey,
    frontendPort,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: identifiers.app.apiSecret ?? '',
    hostname: url,
  })

  const devExt = await devExtensions(options.app, url, frontendPort, store)

  await runConcurrentHTTPProcessesAndPathForwardTraffic(url, frontendPort, [devExt, devFront], [devBack])
}

function devFrontend(web: Web, options: DevWebOptions): ReverseHTTPProxyTarget {
  const {commands} = web.configuration
  const [cmd, ...args] = commands.dev.split(' ')
  const env = {
    SHOPIFY_API_KEY: options.apiKey,
    BACKEND_PORT: `${options.backendPort}`,
    FRONTEND_PORT: `${options.frontendPort}`,
  }

  return {
    logPrefix: web.configuration.type,
    action: async (stdout: any, stderr: any, signal: AbortSignal, port: number) => {
      const newEnv = {
        ...process.env,
        ...env,
        NODE_ENV: `development`,
        FRONTEND_PORT: `${port}`,
      }
      // console.log(port, cmd, args, newEnv)
      await system.exec(cmd, args, {
        cwd: web.directory,
        stdout,
        stderr,
        env: newEnv,
      })
    },
  }
}

function devBackend(web: Web, options: DevWebOptions): output.OutputProcess {
  const {commands} = web.configuration
  const [cmd, ...args] = commands.dev.split(' ')
  const env = {
    SHOPIFY_API_KEY: options.apiKey,
    SHOPIFY_API_SECRET: options.apiSecret,
    HOST: options.hostname,
    BACKEND_PORT: `${options.backendPort}`,
    SCOPES: options.scopes,
  }

  return {
    prefix: web.configuration.type,
    action: async (stdout: any, stderr: any, signal: AbortSignal) => {
      await system.exec(cmd, args, {
        cwd: web.directory,
        stdout,
        stderr,
        env: {
          ...process.env,
          ...env,
          NODE_ENV: `development`,
        },
      })
    },
  }
}

function devWeb(webs: Web[], options: DevWebOptions): ReverseHTTPProxyTarget[] {
  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_KEY = options.apiKey

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_SECRET = options.apiSecret

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const HOST = options.hostname

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SCOPES = options.scopes

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const FRONTEND_PORT = `${options.frontendPort}`

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const BACKEND_PORT = `${options.backendPort}`

  const webActions = webs.map(({configuration, directory}: Web, _index) => {
    const {commands, type} = configuration
    const [cmd, ...args] = commands.dev.split(' ')
    const env =
      type === WebType.Backend
        ? {
            SHOPIFY_API_KEY,
            SHOPIFY_API_SECRET,
            HOST,
            BACKEND_PORT,
            SCOPES,
          }
        : {
            SHOPIFY_API_KEY,
            BACKEND_PORT,
            FRONTEND_PORT,
          }

    return {
      prefix: configuration.type,
      logPrefix: configuration.type,
      action: async (stdout: any, stderr: any, signal: AbortSignal, port: number) => {
        await system.exec(cmd, args, {
          cwd: directory,
          stdout,
          stderr,
          env: {
            ...process.env,
            ...env,
            NODE_ENV: `development`,
            FRONTEND_PORT: port,
          },
        })
      },
    }
  })
  return webActions
}

async function devExtensions(app: App, url: string, _port: number, storeFqdn: string): Promise<ReverseHTTPProxyTarget> {
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => {
      await serveExtensions({app, extensions: app.extensions.ui, stdout, stderr, signal, url, port, storeFqdn})
    },
  }
}

export default dev
