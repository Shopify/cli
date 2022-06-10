import {ensureDevEnvironment} from './environment'
import {generateURL, updateURLs} from './dev/urls'
import {installAppDependencies} from './dependencies'
import {devExtensions} from './dev/extension'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy'
import {App, AppConfiguration, UIExtension, Web, WebType} from '../models/app/app'
import {getExtensionOutputConfig, UIExtensionTypes} from '../constants'
import {error, output, port, system} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'
import {Writable} from 'node:stream'

export interface DevOptions {
  app: App
  apiKey?: string
  storeFqdn?: string
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
    storeFqdn,
    app: {apiSecret},
  } = await ensureDevEnvironment(options)

  if (Object.values(identifiers.extensions).length > 0) {
    output.completed("A production app was selected. We'll use the extensions IDs present in your .env file")
  }

  const proxyPort = await port.getRandomPort()
  const backendPort = await port.getRandomPort()
  const url: string = await generateURL(options, proxyPort)

  const frontendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Frontend)
  const backendConfig = options.app.webs.find(({configuration}) => configuration.type === WebType.Backend)

  /** If the app doesn't have web/ the link message is not necessary */
  if (frontendConfig || backendConfig) {
    let updateMessage = ''
    if (options.update) {
      await updateURLs(identifiers.app, url)
      updateMessage = `\nYour app's URLs in Shopify Partners have been updated. `
    }
    const message = `${updateMessage}\nYour app will be available here: `
    const hostUrl = `${storeFqdn}/admin`
    const hostParam = btoa(hostUrl).replace(/[=]/g, '')
    const storeAppUrl = `${url}?shop=${storeFqdn}&host=${hostParam}`
    output.info(output.content`${message}${output.token.link(storeAppUrl, storeAppUrl)}\n`)
  }

  extensionsURLsOutput(options.app.extensions.ui, storeFqdn, url)
  //   options.app.extensions.ui.forEach((extension) => {
  //     switch (extension.type as UIExtensionTypes) {
  //       case 'checkout_post_purchase': {
  //         output.info(output.content`
  // To view your ${output.token.italic(getExtensionOutputConfig(extension.type).humanKey)} extension:
  //   1. Set up your post-purchase browser extension:
  //       a. Install the ${output.token.link(
  //         'chrome extension',
  //         'https://github.com/shopify/post-purchase-devtools/releases',
  //       )}
  //       b. Enter the root URL into the chrome extension: ${url}/extensions/something
  //   2. Make sure your dev store can process test orders: ${output.token.link(
  //     'Test order documentation',
  //     'https://help.shopify.com/en/partners/dashboard/managing-stores/test-orders-in-dev-stores',
  //   )}
  //   3. Go to ${output.token.link('your store', `https://${storeFqdn}`)} to make a test order and view your extension.
  // `)
  //         break
  //       }
  //       case 'checkout_ui_extension':
  //         const productVariantId = 123
  //         output.info(output.content`
  // To view your ${output.token.italic(getExtensionOutputConfig(extension.type).humanKey)} extension:
  //   1. Log in to your ${output.token.link('dev storefront', `https://${storeFqdn}/password`)}.
  //   2. Visit this ${output.token.link('URL', `https://${storeFqdn}/cart/${productVariantId}:1?dev=${url}/extensions`)}.
  // `)
  //         break
  //       case 'product_subscription':
  //         output.info(output.content`
  // To view your ${output.token.italic(getExtensionOutputConfig(extension.type).humanKey)} extension:
  //   1. Visit this ${output.token.link('URL', `https://${storeFqdn}/admin/extensions-dev?url=${url}/extensions`)}.
  // `)
  //         break
  //       case 'web_pixel_extension':
  //       case 'pos_ui_extension':
  //         break
  //     }
  //   })

  const backendOptions = {
    apiKey: identifiers.app,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: (apiSecret as string) ?? '',
    hostname: url,
  }

  // If we have a real UUID for an extension, use that instead of a random one
  options.app.extensions.ui.forEach((ext) => (ext.devUUID = identifiers.extensions[ext.localIdentifier] ?? ext.devUUID))

  const devExt = await devExtensionsTarget(options.app, identifiers.app, url, storeFqdn)
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
): Promise<ReverseHTTPProxyTarget> {
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => {
      await devExtensions({app, extensions: app.extensions.ui, stdout, stderr, signal, url, port, storeFqdn, apiKey})
    },
  }
}

function extensionsURLsOutput(extensions: UIExtension[], storeFqdn: string, url: string) {
  for (const extension of extensions) {
    let message: output.TokenizedString
    switch (extension.type as UIExtensionTypes) {
      case 'checkout_post_purchase':
        {
          message = output.content`
  1. Set up your post-purchase browser extension:
      a. Install the ${output.token.link(
        'chrome extension',
        'https://github.com/shopify/post-purchase-devtools/releases',
      )}
      b. Enter the root URL into the chrome extension: ${url}/extensions/${extension.localIdentifier}
  2. Make sure your dev store can process test orders: ${output.token.link(
    'Test orders documentation',
    'https://help.shopify.com/en/partners/dashboard/managing-stores/test-orders-in-dev-stores',
  )}
  3. Go to ${output.token.link('your store', `https://${storeFqdn}`)} to make a test order and view your extension.
`
        }
        break
      case 'checkout_ui_extension':
        const productVariantId = 123
        message = output.content`
  1. Log in to your ${output.token.link('dev storefront', `https://${storeFqdn}/password`)}.
  2. Visit this ${output.token.link(
    'URL',
    `https://${storeFqdn}/cart/${productVariantId}:1?dev=${url}/extensions/${extension.localIdentifier}`,
  )}.
`
        break
      case 'product_subscription':
        message = output.content`
  1. Visit this ${output.token.link(
    'URL',
    `https://${storeFqdn}/admin/extensions-dev?url=${url}/extensions/${extension.localIdentifier}`,
  )}.
`
        break
      case 'web_pixel_extension':
      case 'pos_ui_extension':
        continue
    }
    output.info(`${extensionTitle(extension)}${message.value}`)
  }
}

function extensionTitle(extension: UIExtension) {
  const humanKey = getExtensionOutputConfig(extension.type).humanKey
  return output.content`To view your ${output.token.italic(humanKey)} extension:`.value
}

export default dev
