import {ensureDevEnvironment} from './environment.js'
import {generateFrontendURL, generatePartnersURLs, getURLs, shouldOrPromptUpdateURLs, updateURLs} from './dev/urls.js'
import {installAppDependencies} from './dependencies.js'
import {devUIExtensions} from './dev/extension.js'
import {outputAppURL, outputExtensionsMessages, outputUpdateURLsResult} from './dev/output.js'
import {themeExtensionArgs} from './dev/theme-extension-args.js'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy.js'
import {AppInterface, AppConfiguration, Web, WebType} from '../models/app/app.js'
import metadata from '../metadata.js'
import {UIExtension} from '../models/app/extensions.js'
import {fetchProductVariant} from '../utilities/extensions/fetch-product-variant.js'
import {analytics, output, port, system, session, abort, string, path, environment, file} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import express, {Express, Request, Response, NextFunction} from 'express'
import {createProxyMiddleware} from 'http-proxy-middleware'
import fetch from 'node-fetch'
import {createServer} from 'vite'
import {Writable} from 'node:stream'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const virtual = require('vite-plugin-virtual')

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
  token?: string
}

interface DevWebOptions {
  backendPort: number
  apiKey: string
  apiSecret?: string
  hostname?: string
  scopes?: AppConfiguration['scopes']
}

async function dev(options: DevOptions) {
  if (options.app.configuration.type === 'integration') {
    await devIntegrationApp(options)
  } else {
    await devApp(options)
  }
}

async function devIntegrationApp(options: DevOptions) {
  const appFQDN = 'http://127.0.0.1'
  const appPort = await port.getRandomPort()
  const server = express()
  const serverPort = await port.getRandomPort()
  const remixPort = await port.getRandomPort()
  const remixURL = `${appFQDN}:${remixPort}`
  const appURL = `${appFQDN}:${appPort}/`
  const serverURL = `${appFQDN}:${serverPort}/`

  output.info(output.content`\n${output.token.heading('App URL')}\n\n  ${serverURL}_shopify\n`)
  output.info(output.content`${output.token.heading('Logs')}`)

  process.env._SHOPIFY_STORE_FQDN = options.storeFqdn
  process.env._SHOPIFY_APP_TOKEN = options.token
  process.env._SHOPIFY_API_VERSION = options.app.configuration.api_version

  await addPanelMiddleware(server)
  addAPIEndpoints(server, serverURL, options)
  addWebhooksAppProxyMiddleware(server, appURL)
  addRemixProxyMiddleware(server, remixURL)

  // Remix
  await startWebhooksApp(appPort, options)
  await server.listen(serverPort)
  await startRemix(remixPort, options)
}

function addRemixProxyMiddleware(server: Express, remixURL: string) {
  server.use(createProxyMiddleware({target: remixURL, logLevel: 'silent'}))
}

function addWebhooksAppProxyMiddleware(server: Express, appURL: string) {
  server.use(
    createProxyMiddleware(
      (pathname, req) => {
        return pathname.startsWith('/webhooks')
      },
      {target: appURL, logLevel: 'silent'},
    ),
  )
}

function addAPIEndpoints(server: Express, serverURL: string, options: DevOptions) {
  server.get('/api/app-info', (req, res, next) => {
    return res.json({url: serverURL, scopes: options.app.configuration.scopes}).end()
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  server.post('/api/webhooks/products/create', async (req, res, next) => {
    await fetch(`${serverURL}webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        id: 788032119674292922,
        title: 'Example T-Shirt',
        body_html: null,
        vendor: 'Acme',
        product_type: 'Shirts',
        created_at: null,
        handle: 'example-t-shirt',
        updated_at: '2022-10-03T12:55:32-04:00',
        published_at: '2022-10-03T12:55:32-04:00',
        template_suffix: null,
        status: 'active',
        published_scope: 'web',
        tags: 'example, mens, t-shirt',
        admin_graphql_api_id: 'gid://shopify/Product/788032119674292922',
        variants: [
          {
            id: 642667041472713922,
            product_id: 788032119674292922,
            title: '',
            price: '19.99',
            sku: 'example-shirt-s',
            position: 0,
            inventory_policy: 'deny',
            compare_at_price: '24.99',
            fulfillment_service: 'manual',
            inventory_management: 'shopify',
            option1: 'Small',
            option2: null,
            option3: null,
            created_at: null,
            updated_at: null,
            taxable: true,
            barcode: null,
            grams: 200,
            image_id: null,
            weight: 200.0,
            weight_unit: 'g',
            inventory_item_id: null,
            inventory_quantity: 75,
            old_inventory_quantity: 75,
            requires_shipping: true,
            admin_graphql_api_id: 'gid://shopify/ProductVariant/642667041472713922',
          },
          {
            id: 757650484644203962,
            product_id: 788032119674292922,
            title: '',
            price: '19.99',
            sku: 'example-shirt-m',
            position: 0,
            inventory_policy: 'deny',
            compare_at_price: '24.99',
            fulfillment_service: 'manual',
            inventory_management: 'shopify',
            option1: 'Medium',
            option2: null,
            option3: null,
            created_at: null,
            updated_at: null,
            taxable: true,
            barcode: null,
            grams: 200,
            image_id: null,
            weight: 200.0,
            weight_unit: 'g',
            inventory_item_id: null,
            inventory_quantity: 50,
            old_inventory_quantity: 50,
            requires_shipping: true,
            admin_graphql_api_id: 'gid://shopify/ProductVariant/757650484644203962',
          },
        ],
        options: [
          {
            id: 527050010214937811,
            product_id: 788032119674292922,
            name: 'Title',
            position: 1,
            values: ['Small', 'Medium'],
          },
        ],
        images: [
          {
            id: 539438707724640965,
            product_id: 788032119674292922,
            position: 0,
            created_at: null,
            updated_at: null,
            alt: null,
            width: 323,
            height: 434,
            src: '//cdn.shopify.com/shopifycloud/shopify/assets/shopify_shirt-39bb555874ecaeed0a1170417d58bbcf792f7ceb56acfe758384f788710ba635.png',
            variant_ids: [],
            admin_graphql_api_id: 'gid://shopify/ProductImage/539438707724640965',
          },
        ],
        image: null,
      }),
      headers: {
        'X-Shopify-Topic': `products/create`,
        'Content-Type': 'application/json',
      },
    })
    return res.status(200).end()
  })
}

async function addPanelMiddleware(server: Express) {
  const rootDirectory = (await path.findUp('assets/dev-panel', {
    cwd: path.moduleDirectory(import.meta.url),
    type: 'directory',
  })) as string
  server.use('/_shopify', express.static(rootDirectory))
}

async function startWebhooksApp(appPort: number, options: DevOptions) {
  const app = express()
  const viteServer = await createServer({
    root: options.app.directory,
    clearScreen: false,
    plugins: [
      virtual.default({
        '@shopify/app/store': `
        async function graphqlRequest(query, variables = {}) {
          const authenticationHeaders = { 'X-Shopify-Access-Token': '${options.token}'}
          const url = "https://${options.storeFqdn}/admin/api/${options.app.configuration.api_version}/graphql.json";
          console.log(url);
          return (await fetch(url, {
            method: 'POST',
            headers: {
              ...authenticationHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables
            }),
          })).json()
        }
        module.exports = {graphqlRequest}
        `,
      }),
    ],
  })

  const webhooksDirectory = path.join(options.app.directory, 'webhooks')
  app.use([
    express.json(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/webhooks') {
        const topic = req.headers['x-shopify-topic'] as string
        const webhookModulePath = path.join(webhooksDirectory, `${topic}.mjs`)
        if (await file.exists(webhookModulePath)) {
          output.debug(`Processing Webhook with topic ${topic} with module ${webhookModulePath}`)

          const module = await viteServer.ssrLoadModule(webhookModulePath)
          await (
            await module.default
          )(req.body)
        } else {
          output.consoleError(`Webhook with topic ${topic} received but there's no handler defined for it`)
        }
        res.write('success')
        return res.end()
      } else {
        return next()
      }
    },
  ])

  await app.listen(appPort)
}

async function startRemix(remixPort: number, options: DevOptions) {
  const remixDevExecutable = path.join(options.app.directory, 'node_modules/@remix-run/dev/dist/cli.js')
  await system.exec('node', [remixDevExecutable, options.app.directory, '--port', `${remixPort}`], {
    cwd: options.app.directory,
    stdio: 'inherit',
  })
}

async function devApp(options: DevOptions) {
  const skipDependenciesInstallation = options.skipDependenciesInstallation
  if (!skipDependenciesInstallation) {
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
  let shouldUpdateURLs = false
  if ((frontendConfig || backendConfig) && options.update) {
    const currentURLs = await getURLs(apiKey, token)
    const newURLs = generatePartnersURLs(exposedUrl, backendConfig?.configuration.auth_callback_path)
    shouldUpdateURLs = await shouldOrPromptUpdateURLs({
      currentURLs,
      appDirectory: options.app.directory,
      cachedUpdateURLs,
      newApp: app.newApp,
    })
    if (shouldUpdateURLs) await updateURLs(newURLs, apiKey, token)
    await outputUpdateURLsResult(shouldUpdateURLs, newURLs, app)
    outputAppURL(storeFqdn, exposedUrl)
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
    const devExt = await devUIExtensionsTarget({
      app: options.app,
      apiKey,
      url: proxyUrl,
      storeFqdn,
      grantedScopes: app.grantedScopes,
      subscriptionProductUrl: options.subscriptionProductUrl,
      checkoutCartUrl: options.checkoutCartUrl,
    })
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
    additionalProcesses.push(await devBackendTarget(backendConfig, backendOptions))
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

  await logMetadataForDev({devOptions: options, tunnelUrl: frontendUrl, shouldUpdateURLs, storeFqdn})

  await analytics.reportEvent({config: options.commandConfig})

  if (proxyTargets.length === 0) {
    await renderConcurrent({processes: additionalProcesses})
  } else {
    await runConcurrentHTTPProcessesAndPathForwardTraffic(proxyPort, proxyTargets, additionalProcesses)
  }
}

interface DevFrontendTargetOptions extends DevWebOptions {
  web: Web
  backendPort: number
}

function devFrontendNonProxyTarget(options: DevFrontendTargetOptions, port: number): output.OutputProcess {
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
  adminSession: session.AdminSession,
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

async function devBackendTarget(web: Web, options: DevWebOptions): Promise<output.OutputProcess> {
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
    ...(environment.service.isSpinEnvironment() && {
      SHOP_CUSTOM_DOMAIN: `shopify.${await environment.spin.fqdn()}`,
    }),
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

interface DevUIExtensionsTargetOptions {
  app: AppInterface
  apiKey: string
  url: string
  storeFqdn: string
  grantedScopes: string[]
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
}

async function devUIExtensionsTarget({
  app,
  apiKey,
  url,
  storeFqdn,
  grantedScopes,
  subscriptionProductUrl,
  checkoutCartUrl,
}: DevUIExtensionsTargetOptions): Promise<ReverseHTTPProxyTarget> {
  const cartUrl = await buildCartURLIfNeeded(app.extensions.ui, storeFqdn, checkoutCartUrl)
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: abort.Signal, port: number) => {
      await devUIExtensions({
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
        checkoutCartUrl: cartUrl,
        subscriptionProductUrl,
      })
    },
  }
}

/**
 * To prepare Checkout UI Extensions for dev'ing we need to retrieve a valid product variant ID
 * @param extensions - The UI Extensions to dev
 * @param store - The store FQDN
 */
async function buildCartURLIfNeeded(extensions: UIExtension[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.map((ext) => ext.type).includes('checkout_ui_extension')
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

async function logMetadataForDev(options: {
  devOptions: DevOptions
  tunnelUrl: string
  shouldUpdateURLs: boolean
  storeFqdn: string
}) {
  const tunnelType = await analytics.getAnalyticsTunnelType(options.devOptions.commandConfig, options.tunnelUrl)
  await metadata.addPublic(() => ({
    cmd_dev_tunnel_type: tunnelType,
    cmd_dev_tunnel_custom_hash: tunnelType === 'custom' ? string.hashString(options.tunnelUrl) : undefined,
    cmd_dev_urls_updated: options.shouldUpdateURLs,
    store_fqdn_hash: string.hashString(options.storeFqdn),
    cmd_app_dependency_installation_skipped: options.devOptions.skipDependenciesInstallation,
    cmd_app_reset_used: options.devOptions.reset,
  }))

  await metadata.addSensitive(() => ({
    store_fqdn: options.storeFqdn,
    cmd_dev_tunnel_custom: tunnelType === 'custom' ? options.tunnelUrl : undefined,
  }))
}

export default dev
