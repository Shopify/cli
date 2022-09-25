import {ensureDevEnvironment} from './environment.js'
import {generateFrontendURL, generatePartnersURLs, getURLs, shouldOrPromptUpdateURLs, updateURLs} from './dev/urls.js'
import {installAppDependencies} from './dependencies.js'
import {devExtensions} from './dev/extension.js'
import {outputAppURL, outputExtensionsMessages, outputUpdateURLsResult} from './dev/output.js'
import {themeExtensionArgs} from './dev/theme-extension-args.js'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy.js'
import {AppInterface, AppConfiguration, Web, WebType} from '../models/app/app.js'
import {UIExtension} from '../models/app/extensions.js'
import {fetchProductVariant} from '../utilities/extensions/fetch-product-variant.js'
import {analytics, output, port, system, session, abort, environment} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {OutputProcess} from '@shopify/cli-kit/src/output.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession} from '@shopify/cli-kit/src/session.js'
import {Writable} from 'node:stream'

export interface DevOptions {
  app: AppInterface
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  skipDependenciesInstallation: boolean
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
  tunnelUrl?: string
  tunnel: boolean
  noTunnel: boolean
  theme?: string
  themeExtensionPort?: number
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
  const token = await session.ensureAuthenticatedPartners()
  const {
    identifiers,
    storeFqdn,
    app,
    updateURLs: cachedUpdateURLs,
    tunnelPlugin,
  } = await ensureDevEnvironment(options, token)
  const apiKey = identifiers.app

  const {frontendUrl, frontendPort, usingLocalhost} = await generateFrontendURL({
    ...options,
    cachedTunnelPlugin: tunnelPlugin,
  })

  const backendPort = await port.getRandomPort()

  const frontendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Frontend)
  const backendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Backend)

  /** If the app doesn't have web/ the link message is not necessary */
  const exposedUrl = usingLocalhost ? `${frontendUrl}:${frontendPort}` : frontendUrl
  if ((frontendConfig || backendConfig) && options.update) {
    const currentURLs = await getURLs(apiKey, token)
    const finalExposedUrl = environment.spin.isSpin()
      ? `https://${await environment.spin.fqdn()}:${frontendPort}`
      : exposedUrl
    const newURLs = generatePartnersURLs(finalExposedUrl)
    const shouldUpdate: boolean = await shouldOrPromptUpdateURLs({
      currentURLs,
      appDirectory: options.app.directory,
      cachedUpdateURLs,
      newApp: app.newApp,
    })
    if (shouldUpdate) await updateURLs(newURLs, apiKey, token)
    outputUpdateURLsResult(shouldUpdate, newURLs, app)
    outputAppURL(storeFqdn, finalExposedUrl)
  }

  // If we have a real UUID for an extension, use that instead of a random one
  options.app.extensions.ui.forEach((ext) => (ext.devUUID = identifiers.extensions[ext.localIdentifier] ?? ext.devUUID))

  const backendOptions = {
    apiKey,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: (app.apiSecret as string) ?? '',
    hostname: exposedUrl,
  }

  const proxyTargets: ReverseHTTPProxyTarget[] = []
  const proxyPort = usingLocalhost ? await port.getRandomPort() : frontendPort
  const proxyUrl = usingLocalhost ? `${frontendUrl}:${proxyPort}` : frontendUrl

  if (options.app.extensions.ui.length > 0) {
    const devExt = await devUIExtensionsTarget(
      options.app,
      apiKey,
      proxyUrl,
      storeFqdn,
      app.grantedScopes,
      options.subscriptionProductUrl,
      options.checkoutCartUrl,
    )
    proxyTargets.push(devExt)
  }

  outputExtensionsMessages(options.app, storeFqdn, proxyUrl)

  const additionalProcesses: output.OutputProcess[] = []

  if (options.app.extensions.theme.length > 0) {
    const adminSession = await session.ensureAuthenticatedAdmin(storeFqdn)
    const storefrontToken = await session.ensureAuthenticatedStorefront()
    const extension = options.app.extensions.theme[0]!
    const args = await themeExtensionArgs(extension, apiKey, token, options)
    const devExt = await devThemeExtensionTarget(args, adminSession, storefrontToken, token)
    additionalProcesses.push(devExt)
  }

  if (backendConfig) {
    additionalProcesses.push(devBackendTarget(backendConfig, backendOptions))
  }

  if (frontendConfig) {
    const frontendOptions: DevFrontendTargetOptions = {
      web: frontendConfig,
      apiKey,
      scopes: options.app.configuration.scopes,
      apiSecret: (app.apiSecret as string) ?? '',
      hostname: frontendUrl,
      backendPort,
    }

    if (usingLocalhost) {
      additionalProcesses.push(devFrontendNonProxyTarget(frontendOptions, frontendPort))
    } else {
      proxyTargets.push(devFrontendProxyTarget(frontendOptions))
    }
  }

  await analytics.reportEvent({config: options.commandConfig})

  if (proxyTargets.length === 0) {
    await output.concurrent(additionalProcesses)
  } else {
    await runConcurrentHTTPProcessesAndPathForwardTraffic(proxyPort, proxyTargets, additionalProcesses)
  }
}

interface DevFrontendTargetOptions extends DevWebOptions {
  web: Web
  backendPort: number
}

function devFrontendNonProxyTarget(options: DevFrontendTargetOptions, port: number): OutputProcess {
  const devFrontend = devFrontendProxyTarget(options)
  return {
    prefix: devFrontend.logPrefix,
    action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
      await devFrontend.action(stdout, stderr, signal, port)
    },
  }
}

function devThemeExtensionTarget(
  args: string[],
  adminSession: AdminSession,
  storefrontToken: string,
  token: string,
): output.OutputProcess {
  return {
    prefix: 'extensions',
    action: async (_stdout: Writable, _stderr: Writable, _signal: abort.Signal) => {
      await execCLI2(['extension', 'serve', ...args], {adminSession, storefrontToken, token})
    },
  }
}

function devFrontendProxyTarget(options: DevFrontendTargetOptions): ReverseHTTPProxyTarget {
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
    action: async (stdout: Writable, stderr: Writable, signal: abort.Signal, port: number) => {
      await system.exec(cmd!, args, {
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
    action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
      await system.exec(cmd!, args, {
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

async function devUIExtensionsTarget(
  app: AppInterface,
  apiKey: string,
  url: string,
  storeFqdn: string,
  grantedScopes: string[],
  subscriptionProductUrl?: string,
  checkoutCartUrl?: string,
): Promise<ReverseHTTPProxyTarget> {
  const cartUrl = await buildCartURLIfNeeded(app.extensions.ui, storeFqdn, checkoutCartUrl)
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: abort.Signal, port: number) => {
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
        grantedScopes,
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
