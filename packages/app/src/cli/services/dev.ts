import {ensureDevContext} from './context.js'
import {
  generateFrontendURL,
  generatePartnersURLs,
  getURLs,
  shouldOrPromptUpdateURLs,
  startTunnelPlugin,
  updateURLs,
} from './dev/urls.js'
import {installAppDependencies} from './dependencies.js'
import {devUIExtensions} from './dev/extension.js'
import {setupGraphiQLServer} from './dev/graphiql/server.js'
import {outputUpdateURLsResult, renderDev} from './dev/ui.js'
import {themeExtensionArgs} from './dev/theme-extension-args.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {sendUninstallWebhookToAppServer} from './webhook/send-app-uninstalled-webhook.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {setupConfigWatcher, setupDraftableExtensionBundler, setupFunctionWatcher} from './dev/extension/bundler.js'
import {updateExtensionDraft} from './dev/update-extension.js'
import {setCachedAppInfo} from './local-storage.js'
import {DeploymentMode} from './deploy/mode.js'
import {canEnablePreviewMode} from './extensions/common.js'
import {environmentVariableNames, urlNamespaces} from '../constants.js'
import {
  ReverseHTTPProxyTarget,
  runConcurrentHTTPProcessesAndPathForwardTraffic,
} from '../utilities/app/http-reverse-proxy.js'
import {
  getAppScopesArray,
  AppInterface,
  Web,
  WebType,
  isLegacyAppSchema,
  isCurrentAppSchema,
} from '../models/app/app.js'
import metadata from '../metadata.js'
import {fetchProductVariant} from '../utilities/extensions/fetch-product-variant.js'
import {loadApp} from '../models/app/loader.js'
import {getAppIdentifiers, updateAppIdentifiers} from '../models/app/identifiers.js'
import {getAnalyticsTunnelType} from '../utilities/analytics.js'
import {buildAppURLForWeb} from '../utilities/app/app-url.js'
import {HostThemeManager} from '../utilities/host-theme-manager.js'

import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {Config} from '@oclif/core'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {exec} from '@shopify/cli-kit/node/system'
import {isSpinEnvironment, spinFqdn} from '@shopify/cli-kit/node/context/spin'
import {
  AdminSession,
  ensureAuthenticatedAdmin,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
} from '@shopify/cli-kit/node/session'
import {OutputProcess, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getBackendPort} from '@shopify/cli-kit/node/environment'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {basename} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

export const MANIFEST_VERSION = '3'

export interface DevOptions {
  directory: string
  id?: number
  configName?: string
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  skipDependenciesInstallation: boolean
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
  tunnelUrl?: string
  noTunnel: boolean
  theme?: string
  themeExtensionPort?: number
  notify?: string
}

async function dev(options: DevOptions) {
  // Be optimistic about tunnel creation and do it as early as possible
  const tunnelPort = await getAvailableTCPPort()

  let tunnelClient: TunnelClient | undefined
  if (!options.tunnelUrl && !options.noTunnel) {
    tunnelClient = await startTunnelPlugin(options.commandConfig, tunnelPort, 'cloudflare')
  }

  const token = await ensureAuthenticatedPartners()
  const {
    storeFqdn,
    remoteApp,
    remoteAppUpdated,
    updateURLs: cachedUpdateURLs,
    configName,
  } = await ensureDevContext(options, token)

  const apiKey = remoteApp.apiKey
  const developmentStorePreviewEnabled = remoteApp.developmentStorePreviewEnabled
  const specifications = await fetchSpecifications({token, apiKey, config: options.commandConfig})

  let localApp = await loadApp({directory: options.directory, specifications, configName})

  if (!options.skipDependenciesInstallation && !localApp.usesWorkspaces) {
    localApp = await installAppDependencies(localApp)
  }

  if (
    isCurrentAppSchema(localApp.configuration) &&
    !localApp.configuration.access_scopes?.use_legacy_install_flow &&
    getAppScopesArray(localApp.configuration).sort().join(',') !== remoteApp.requestedAccessScopes?.sort().join(',')
  ) {
    const nextSteps = [
      [
        'Run',
        {command: formatPackageManagerCommand(localApp.packageManager, 'shopify app config push')},
        'to push your scopes to the Partner Dashboard',
      ],
    ]

    renderWarning({
      headline: [`The scopes in your TOML don't match the scopes in your Partner Dashboard`],
      body: [
        `Scopes in ${basename(localApp.configuration.path)}:`,
        scopesMessage(getAppScopesArray(localApp.configuration)),
        '\n',
        'Scopes in Partner Dashboard:',
        scopesMessage(remoteApp.requestedAccessScopes || []),
      ],
      nextSteps,
    })
  }

  const frontendConfig = localApp.webs.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = localApp.webs.find((web) => isWebType(web, WebType.Backend))

  await validateCustomPorts(localApp.webs)

  const [{frontendUrl, frontendPort, usingLocalhost}, backendPort, graphiqlPort, currentURLs] = await Promise.all([
    generateFrontendURL({
      ...options,
      tunnelClient,
    }),
    getBackendPort() || backendConfig?.configuration.port || getAvailableTCPPort(),
    getAvailableTCPPort(),
    getURLs(apiKey, token),
  ])
  let frontendServerPort = frontendConfig?.configuration.port
  if (frontendConfig) {
    if (!frontendServerPort) {
      frontendServerPort = frontendConfig === backendConfig ? backendPort : await getAvailableTCPPort()
    }
    frontendConfig.configuration.port = frontendServerPort
  }

  const exposedUrl = usingLocalhost ? `${frontendUrl}:${frontendPort}` : frontendUrl
  let shouldUpdateURLs = false
  if (frontendConfig || backendConfig) {
    if (options.update) {
      const newURLs = generatePartnersURLs(
        exposedUrl,
        localApp.webs.map(({configuration}) => configuration.auth_callback_path).find((path) => path),
        isCurrentAppSchema(localApp.configuration) ? localApp.configuration.app_proxy : undefined,
      )
      shouldUpdateURLs = await shouldOrPromptUpdateURLs({
        currentURLs,
        appDirectory: localApp.directory,
        cachedUpdateURLs,
        newApp: remoteApp.newApp,
        localApp,
        apiKey,
      })
      if (shouldUpdateURLs) await updateURLs(newURLs, apiKey, token, localApp)
      await outputUpdateURLsResult(shouldUpdateURLs, newURLs, remoteApp, localApp)
    }
  }

  // If we have a real UUID for an extension, use that instead of a random one
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})
  {
    const envExtensionsIds = prodEnvIdentifiers.extensions || {}
    const extensionsIds = prodEnvIdentifiers.app === apiKey ? envExtensionsIds : {}
    localApp.allExtensions.forEach((ext) => (ext.devUUID = extensionsIds[ext.localIdentifier] ?? ext.devUUID))
  }

  // By default, preview goes to the direct URL for the app.
  const appPreviewUrl = buildAppURLForWeb(storeFqdn, apiKey)
  let previewUrl = appPreviewUrl

  const proxyPort = usingLocalhost ? await getAvailableTCPPort() : frontendPort
  const proxyUrl = usingLocalhost ? `${frontendUrl}:${proxyPort}` : frontendUrl

  const apiSecret = (remoteApp.apiSecret as string) ?? ''

  const additionalProcesses: OutputProcess[] = []
  const proxyTargets: ReverseHTTPProxyTarget[] = []

  {
    const hmrServerPort = frontendConfig?.configuration.hmr_server ? await getAvailableTCPPort() : undefined
    const webOptions = {
      apiKey,
      scopes: isLegacyAppSchema(localApp.configuration)
        ? localApp.configuration.scopes
        : localApp.configuration.access_scopes?.scopes,
      apiSecret,
      backendPort,
      frontendServerPort,
      hmrServerPort,
    }

    await Promise.all(
      localApp.webs.map(async (web) => {
        const isFrontend = isWebType(web, WebType.Frontend)
        const hostname = isFrontend ? frontendUrl : exposedUrl
        const fullWebOptions: DevWebOptions = {...webOptions, web, hostname}

        if (isFrontend && !usingLocalhost) {
          proxyTargets.push(await devProxyTarget(fullWebOptions))
        } else {
          let port: number
          if (isFrontend) {
            port = frontendPort
          } else if (isWebType(web, WebType.Backend)) {
            port = backendPort
          } else {
            port = await getAvailableTCPPort()
          }
          additionalProcesses.push(await devNonProxyTarget(fullWebOptions, port))
        }
      }),
    )
  }

  const unifiedDeployment = remoteApp?.betas?.unifiedAppDeployment ?? false
  const deploymentMode = unifiedDeployment ? 'unified' : 'legacy'

  const previewableExtensions = localApp.allExtensions.filter((ext) => ext.isPreviewable)
  const draftableExtensions = localApp.allExtensions.filter((ext) => ext.isDraftable(unifiedDeployment))
  const themeExtensions = localApp.allExtensions.filter((ext) => ext.isThemeExtension)

  if (previewableExtensions.length > 0) {
    // If any previewable extensions, the preview URL should be the dev console approach
    previewUrl = `${proxyUrl}/extensions/dev-console`
    const devExt = await devUIExtensionsTarget({
      app: localApp,
      id: remoteApp.id,
      apiKey,
      url: proxyUrl,
      storeFqdn,
      grantedScopes: remoteApp.grantedScopes,
      subscriptionProductUrl: options.subscriptionProductUrl,
      checkoutCartUrl: options.checkoutCartUrl,
      extensions: previewableExtensions,
    })
    proxyTargets.push(devExt)
  }

  if (draftableExtensions.length > 0) {
    const identifiers = await ensureDeploymentIdsPresence({
      app: localApp,
      partnersApp: remoteApp,
      appId: apiKey,
      appName: remoteApp.title,
      force: true,
      deploymentMode,
      token,
      envIdentifiers: prodEnvIdentifiers,
    })

    if (isCurrentAppSchema(localApp.configuration)) {
      await updateAppIdentifiers({app: localApp, identifiers, command: 'deploy'})
    }

    additionalProcesses.push(
      devDraftableExtensionTarget({
        app: localApp,
        apiKey,
        url: proxyUrl,
        token,
        extensions: draftableExtensions,
        remoteExtensions: identifiers.extensionIds,
        unifiedDeployment,
      }),
    )
  }

  if (themeExtensions.length > 0) {
    const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
    const extension = themeExtensions[0]!
    let optionsToOverwrite = {}
    if (!options.theme) {
      const theme = await new HostThemeManager(adminSession).findOrCreate()
      optionsToOverwrite = {
        theme: theme.id.toString(),
        generateTmpTheme: true,
      }
    }
    const [storefrontToken, args] = await Promise.all([
      ensureAuthenticatedStorefront(),
      themeExtensionArgs(extension, apiKey, token, {...options, ...optionsToOverwrite}),
    ])
    const devExt = devThemeExtensionTarget(args, adminSession, storefrontToken, token, unifiedDeployment)
    additionalProcesses.push(devExt)
  }

  const scopesArray = getAppScopesArray(localApp.configuration)
  const shouldRenderGraphiQL =
    scopesArray.length > 0 &&
    shouldUpdateURLs &&
    (isUnitTest() || (await isShopify()) || isTruthy(process.env[environmentVariableNames.enableGraphiQLExplorer]))
  if (shouldRenderGraphiQL) {
    proxyTargets.push(
      devGraphiQLTarget({
        appName: localApp.name,
        appUrl: appPreviewUrl,
        apiKey,
        apiSecret,
        storeFqdn,
        url: proxyUrl.replace(/^https?:\/\//, ''),
        port: graphiqlPort,
        scopes: scopesArray,
      }),
    )
  }

  const webhooksPath =
    localApp.webs.map(({configuration}) => configuration.webhooks_path).find((path) => path) || '/api/webhooks'
  const sendUninstallWebhook = Boolean(webhooksPath) && remoteAppUpdated && Boolean(frontendConfig || backendConfig)

  if (sendUninstallWebhook) {
    additionalProcesses.push({
      prefix: 'webhooks',
      action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
        // If we have a backend, use that port, otherwise use the frontend port
        const deliveryPort = backendConfig ? backendPort : frontendPort

        await sendUninstallWebhookToAppServer({
          stdout,
          token,
          address: `http://localhost:${deliveryPort}${webhooksPath}`,
          sharedSecret: apiSecret,
          storeFqdn,
        })
      },
    })
  }

  setPreviousAppId(options.directory, apiKey)

  await logMetadataForDev({devOptions: options, tunnelUrl: frontendUrl, shouldUpdateURLs, storeFqdn, deploymentMode})

  await reportAnalyticsEvent({config: options.commandConfig})

  const abortController = new AbortController()

  const processesIncludingAnyProxies = await runConcurrentHTTPProcessesAndPathForwardTraffic({
    portNumber: proxyPort,
    proxyTargets,
    additionalProcesses,
    abortController,
  })

  const app = {
    canEnablePreviewMode: canEnablePreviewMode(remoteApp, localApp),
    developmentStorePreviewEnabled,
    apiKey,
    token,
  }

  await renderDev({
    processes: processesIncludingAnyProxies,
    previewUrl,
    ...(shouldRenderGraphiQL ? {graphiqlUrl: `${proxyUrl}/${urlNamespaces.devTools}/graphiql`} : {}),
    app,
    abortController,
  })
}

export function setPreviousAppId(directory: string, apiKey: string) {
  setCachedAppInfo({directory, previousAppId: apiKey})
}

function isWebType(web: Web, type: WebType): boolean {
  return web.configuration.roles.includes(type)
}

interface DevWebOptions {
  web: Web
  backendPort: number
  frontendServerPort: number | undefined
  hmrServerPort?: number
  apiKey: string
  apiSecret?: string
  hostname?: string
  scopes?: string
}

async function devNonProxyTarget(options: DevWebOptions, port: number): Promise<OutputProcess> {
  const {logPrefix, action} = await devProxyTarget(options)
  return {
    prefix: logPrefix,
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      await action(stdout, stderr, signal, port)
    },
  }
}

function devThemeExtensionTarget(
  args: string[],
  adminSession: AdminSession,
  storefrontToken: string,
  token: string,
  unifiedDeployment = false,
): OutputProcess {
  return {
    prefix: 'extensions',
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      await execCLI2(['extension', 'serve', ...args], {
        store: adminSession.storeFqdn,
        adminToken: adminSession.token,
        storefrontToken,
        token,
        stdout,
        stderr,
        signal,
        unifiedDeployment,
      })
    },
  }
}

async function devProxyTarget(options: DevWebOptions): Promise<ReverseHTTPProxyTarget> {
  const port = options.web.configuration.port

  const hmrServerOptions =
    options.hmrServerPort && options.web.configuration.roles.includes(WebType.Frontend)
      ? {
          port: options.hmrServerPort,
          httpPaths: options.web.configuration.hmr_server!.http_paths,
        }
      : undefined

  return {
    logPrefix: options.web.configuration.name ?? ['web', ...options.web.configuration.roles].join('-'),
    customPort: port,
    ...(hmrServerOptions && {hmrServer: hmrServerOptions}),
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => {
      return launchWebProcess(
        {stdout, stderr, abortSignal: signal},
        {
          port,
          apiKey: options.apiKey,
          apiSecret: options.apiSecret,
          hostname: options.hostname,
          backendPort: options.backendPort,
          frontendServerPort: options.frontendServerPort,
          directory: options.web.directory,
          devCommand: options.web.configuration.commands.dev,
          scopes: options.scopes,
          shopCustomDomain: isSpinEnvironment() ? `shopify.${await spinFqdn()}` : undefined,
          hmrServerOptions,
        },
      )
    },
  }
}

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
  const [cmd, ...args] = devCommand.split(' ')

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

interface DevGraphiQLTargetOptions {
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  port: number
  url: string
  storeFqdn: string
  scopes: string[]
}

function devGraphiQLTarget(options: DevGraphiQLTargetOptions): ReverseHTTPProxyTarget {
  return {
    logPrefix: 'graphiql',
    pathPrefix: `/${urlNamespaces.devTools}/graphiql`,
    customPort: options.port,
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => {
      const httpServer = setupGraphiQLServer({...options, stdout, port})
      signal.addEventListener('abort', async () => {
        await httpServer.close()
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
  id?: string
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
  extensions: ExtensionInstance[]
}

async function devUIExtensionsTarget({
  app,
  apiKey,
  id,
  url,
  storeFqdn,
  grantedScopes,
  subscriptionProductUrl,
  checkoutCartUrl,
  extensions,
}: DevUIExtensionsTargetOptions): Promise<ReverseHTTPProxyTarget> {
  const cartUrl = await buildCartURLIfNeeded(extensions, storeFqdn, checkoutCartUrl)
  return {
    logPrefix: 'extensions',
    pathPrefix: '/extensions',
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => {
      await devUIExtensions({
        appName: app.name,
        appDirectory: app.directory,
        appDotEnvFile: app.dotenv,
        id,
        extensions,
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
        manifestVersion: MANIFEST_VERSION,
      })
    },
  }
}

interface DevDraftableExtensionsOptions {
  app: AppInterface
  apiKey: string
  url: string
  token: string
  extensions: ExtensionInstance[]
  remoteExtensions: {
    [key: string]: string
  }
  unifiedDeployment: boolean
}

export function devDraftableExtensionTarget({
  extensions,
  app,
  url,
  apiKey,
  token,
  remoteExtensions,
  unifiedDeployment,
}: DevDraftableExtensionsOptions) {
  return {
    prefix: 'extensions',
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      // Functions will only be passed to this target if unified deployments are enabled
      // ESBuild will take care of triggering an initial build & upload for the extensions with ESBUILD feature.
      // For the rest we need to manually upload an initial draft.
      const initialDraftExtensions = extensions.filter((ext) => !ext.isESBuildExtension)
      await Promise.all(
        initialDraftExtensions.map(async (extension) => {
          await extension.build({app, stdout, stderr, useTasks: false, signal})
          const registrationId = remoteExtensions[extension.localIdentifier]
          if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
          await updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr, unifiedDeployment})
        }),
      )

      await Promise.all(
        extensions
          .map((extension) => {
            const registrationId = remoteExtensions[extension.localIdentifier]
            if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)

            const actions = [
              setupConfigWatcher({
                extension,
                token,
                apiKey,
                registrationId,
                stdout,
                stderr,
                signal,
                unifiedDeployment,
              }),
            ]

            // Only extensions with esbuild feature should be whatched using esbuild
            if (extension.features.includes('esbuild')) {
              actions.push(
                setupDraftableExtensionBundler({
                  extension,
                  app,
                  url,
                  token,
                  apiKey,
                  registrationId,
                  stderr,
                  stdout,
                  signal,
                  unifiedDeployment,
                }),
              )
            }

            // watch for Function changes that require a build and push
            if (extension.isFunctionExtension) {
              // watch for changes
              actions.push(
                setupFunctionWatcher({
                  extension,
                  app,
                  stdout,
                  stderr,
                  signal,
                  token,
                  apiKey,
                  registrationId,
                  unifiedDeployment,
                }),
              )
            }

            return actions
          })
          .flat(),
      )
    },
  }
}

/**
 * To prepare Checkout UI Extensions for dev'ing we need to retrieve a valid product variant ID
 * @param extensions - The UI Extensions to dev
 * @param store - The store FQDN
 */
export async function buildCartURLIfNeeded(extensions: ExtensionInstance[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.map((ext) => ext.type).includes('checkout_ui_extension')
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

export async function logMetadataForDev(options: {
  devOptions: DevOptions
  tunnelUrl: string
  shouldUpdateURLs: boolean
  storeFqdn: string
  deploymentMode: DeploymentMode | undefined
}) {
  const tunnelType = await getAnalyticsTunnelType(options.devOptions.commandConfig, options.tunnelUrl)
  await metadata.addPublicMetadata(() => ({
    cmd_dev_tunnel_type: tunnelType,
    cmd_dev_tunnel_custom_hash: tunnelType === 'custom' ? hashString(options.tunnelUrl) : undefined,
    cmd_dev_urls_updated: options.shouldUpdateURLs,
    store_fqdn_hash: hashString(options.storeFqdn),
    cmd_app_dependency_installation_skipped: options.devOptions.skipDependenciesInstallation,
    cmd_app_reset_used: options.devOptions.reset,
    cmd_app_deployment_mode: options.deploymentMode,
  }))

  await metadata.addSensitiveMetadata(() => ({
    store_fqdn: options.storeFqdn,
    cmd_dev_tunnel_custom: tunnelType === 'custom' ? options.tunnelUrl : undefined,
  }))
}

export async function validateCustomPorts(webConfigs: Web[]) {
  const allPorts = webConfigs.map((config) => config.configuration.port).filter((port) => port)
  const duplicatedPort = allPorts.find((port, index) => allPorts.indexOf(port) !== index)
  if (duplicatedPort) {
    throw new AbortError(`Found port ${duplicatedPort} for multiple webs.`, 'Please define a unique port for each web.')
  }
  await Promise.all(
    allPorts.map(async (port) => {
      const portAvailable = await checkPortAvailability(port!)
      if (!portAvailable) {
        throw new AbortError(`Hard-coded port ${port} is not available, please choose a different one.`)
      }
    }),
  )
}

export function scopesMessage(scopes: string[]) {
  return {
    list: {
      items: scopes.length === 0 ? ['No scopes'] : scopes,
    },
  }
}

export default dev
