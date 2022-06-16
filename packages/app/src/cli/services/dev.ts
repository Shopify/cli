import {ensureDevEnvironment} from './environment'
import {generateURL, updateURLs} from './dev/urls'
import {installAppDependencies} from './dependencies'
import {devExtensions} from './dev/extension'
import {outputAppURL, outputExtensionsMessages} from './dev/output'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy'
import {App, AppConfiguration, UIExtension, Web, WebType} from '../models/app/app'
import {fetchProductVariant} from '../utilities/extensions/fetch-product-variant'
import {error, output, port, system} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {Writable} from 'node:stream'

export interface DevOptions {
  app: App
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  skipDependenciesInstallation: boolean
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
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
    storeFqdn,
    app: {apiSecret},
  } = await ensureDevEnvironment(options)

  if (Object.values(identifiers.extensions).length > 0) {
    output.completed("A production app was selected. We'll use the extensions IDs present in your .env file")
  }

  const proxyPort = await port.getRandomPort()
  const backendPort = await port.getRandomPort()
  const url: string = await generateURL(options.commandConfig.plugins, proxyPort)

  const frontendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Frontend)
  const backendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Backend)

  /** If the app doesn't have web/ the link message is not necessary */
  if (frontendConfig || backendConfig) {
    if (options.update) await updateURLs(identifiers.app, url)
    outputAppURL(options.update, storeFqdn, url)
  }

  // If we have a real UUID for an extension, use that instead of a random one
  options.app.extensions.ui.forEach((ext) => (ext.devUUID = identifiers.extensions[ext.localIdentifier] ?? ext.devUUID))

  outputExtensionsMessages(options.app, storeFqdn, url)

  const backendOptions = {
    apiKey: identifiers.app,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: (apiSecret as string) ?? '',
    hostname: url,
  }

  const devExt = await devExtensionsTarget(
    options.app,
    identifiers.app,
    url,
    storeFqdn,
    options.subscriptionProductUrl,
    options.checkoutCartUrl,
  )
  const proxyTargets: ReverseHTTPProxyTarget[] = [devExt]
  if (frontendConfig) {
    proxyTargets.push(
      devFrontendTarget({
        web: frontendConfig,
        apiKey: identifiers.app,
        scopes: options.app.configuration.scopes,
        apiSecret: (apiSecret as string) ?? '',
        hostname: url,
        backendPort,
      }),
    )
  }

  const additionalProcesses: output.OutputProcess[] = []
  if (backendConfig) {
    additionalProcesses.push(devBackendTarget(backendConfig, backendOptions))
  }
  await options.commandConfig.runHook('monorail', {id: 'app dev'})

  await runConcurrentHTTPProcessesAndPathForwardTraffic(url, proxyPort, proxyTargets, additionalProcesses)
}

interface DevFrontendTargetOptions extends DevWebOptions {
  web: Web
  backendPort: number
}

function devFrontendTarget(options: DevFrontendTargetOptions): ReverseHTTPProxyTarget {
  const {commands} = options.web.configuration
  const [cmd, ...args] = commands.dev.split(' ')
  const env = {
    SHOPIFY_API_KEY: options.apiKey,
    SHOPIFY_API_SECRET: options.apiSecret,
    HOST: options.hostname,
    SCOPES: options.scopes,
    BACKEND_PORT: `${options.backendPort}`,
    NODE_ENV: `development`,
  }

  return {
    logPrefix: options.web.configuration.type,
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => {
      await system.exec(cmd, args, {
        cwd: options.web.directory,
        stdout,
        stderr,
        env: {
          ...process.env,
          ...env,
          PORT: `${port}`,
          FRONTEND_PORT: `${port}`,
          APP_URL: options.hostname,
          APP_ENV: 'development',
          // Note: These are Laravel varaibles for backwards compatibility with 2.0 templates.
          SERVER_PORT: `${port}`,
        },
        signal,
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
    // SERVER_PORT is the convention Artisan uses
    PORT: `${options.backendPort}`,
    SERVER_PORT: `${options.backendPort}`,
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
        signal,
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
  subscriptionProductUrl?: string,
  checkoutCartUrl?: string,
): Promise<ReverseHTTPProxyTarget> {
  const cartUrl = await buildCartURLIfNeeded(app.extensions.ui, storeFqdn, checkoutCartUrl)
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => {
      await devExtensions({
        app,
        extensions: app.extensions.ui,
        stdout,
        stderr,
        signal,
        url,
        port,
        storeFqdn,
        apiKey,
        cartUrl,
        subscriptionProductUrl,
      })
    },
  }
}

/**
 * To prepare Checkout UI Extensions for dev'ing we need to retrieve a valid product variant ID
 * @param extensions {UIExtension[]} - The UI Extensions to dev
 * @param store {string} - The store FQDN
 */
async function buildCartURLIfNeeded(extensions: UIExtension[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.map((ext) => ext.type).includes('checkout_ui_extension')
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

export default dev
