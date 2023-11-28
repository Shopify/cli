import {updateURLsPrompt} from '../../prompts/dev.js'
import {AppConfigurationInterface, AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {UpdateURLsQuery, UpdateURLsQuerySchema, UpdateURLsQueryVariables} from '../../api/graphql/update_urls.js'
import {GetURLsQuery, GetURLsQuerySchema, GetURLsQueryVariables} from '../../api/graphql/get_urls.js'
import {setCachedAppInfo} from '../local-storage.js'
import {writeAppConfigurationFile} from '../app/write-app-configuration-file.js'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {isValidURL} from '@shopify/cli-kit/common/url'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {appHost, appPort, isSpin, spinFqdn} from '@shopify/cli-kit/node/context/spin'
import {codespaceURL, codespacePortForwardingDomain, gitpodURL} from '@shopify/cli-kit/node/context/local'
import {fanoutHooks} from '@shopify/cli-kit/node/plugins'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {getPathValue, setPathValue} from '@shopify/cli-kit/common/object'

export interface PartnersURLs {
  applicationUrl: string
  redirectUrlWhitelist: string[]
  appProxy?: {proxyUrl: string; proxySubPath: string; proxySubPathPrefix: string}
}

export interface FrontendURLOptions {
  noTunnel: boolean
  tunnelUrl?: string
  commandConfig: Config
  tunnelClient: TunnelClient | undefined
}

export interface FrontendURLResult {
  frontendUrl: string
  frontendPort: number
  usingLocalhost: boolean
}

/**
 * The tunnel creation logic depends on 7 variables:
 * - If a Codespaces environment is deteced, then the URL is built using the codespaces hostname. No need for tunnel
 * - If a Gitpod environment is detected, then the URL is built using the gitpod hostname. No need for tunnel
 * - If a Spin environment is detected, then the URL is built using the cli + fqdn hostname as configured in nginx.
 *   No need for tunnel. In case problems with that configuration, the flags Tunnel or Custom Tunnel url could be used
 * - If a tunnelUrl is provided, that takes preference and is returned as the frontendURL
 * - If noTunnel is true, that takes second preference and localhost is used
 * - Otherwise, a tunnel is created. (by default using cloudflare)
 *
 * If there is no cached tunnel plugin and a tunnel is necessary, we'll ask the user to confirm.
 */
export async function generateFrontendURL(options: FrontendURLOptions): Promise<FrontendURLResult> {
  let frontendPort = 4040
  let frontendUrl = ''
  let usingLocalhost = false

  if (codespaceURL()) {
    frontendUrl = `https://${codespaceURL()}-${frontendPort}.${codespacePortForwardingDomain()}`
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (gitpodURL()) {
    const defaultUrl = gitpodURL()?.replace('https://', '')
    frontendUrl = `https://${frontendPort}-${defaultUrl}`
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (isSpin() && !options.tunnelUrl) {
    frontendUrl = `https://cli.${await spinFqdn()}`
    const cliMainServicePort = appPort()
    if (cliMainServicePort !== undefined && (await checkPortAvailability(cliMainServicePort))) {
      frontendPort = cliMainServicePort
      frontendUrl = `https://${appHost()}`
    }
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (options.tunnelUrl) {
    const matches = options.tunnelUrl.match(/(https:\/\/[^:]+):([0-9]+)/)
    if (!matches) {
      throw new AbortError(`Invalid tunnel URL: ${options.tunnelUrl}`, 'Valid format: "https://my-tunnel-url:port"')
    }
    frontendPort = Number(matches[2])
    frontendUrl = matches[1]!
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (options.noTunnel) {
    frontendPort = await getAvailableTCPPort()
    frontendUrl = 'http://localhost'
    usingLocalhost = true
  } else if (options.tunnelClient) {
    const url = await pollTunnelURL(options.tunnelClient)
    frontendPort = options.tunnelClient.port
    frontendUrl = url
  }

  return {frontendUrl, frontendPort, usingLocalhost}
}

/**
 * Poll the tunnel provider every 0.5 until an URL or error is returned.
 */
async function pollTunnelURL(tunnelClient: TunnelClient): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let retries = 0
    const pollTunnelStatus = async () => {
      const result = tunnelClient.getTunnelStatus()
      outputDebug(`Polling tunnel status for ${tunnelClient.provider} (attempt ${retries}): ${result.status}`)
      if (result.status === 'error') return reject(new AbortError(result.message, result.tryMessage))
      if (result.status === 'connected') {
        resolve(result.url)
      } else {
        retries += 1
        startPolling()
      }
    }
    const startPolling = () => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(pollTunnelStatus, 500)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pollTunnelStatus()
  })
}

export function generatePartnersURLs(
  baseURL: string,
  authCallbackPath?: string | string[],
  proxyFields?: {url: string; subpath: string; prefix: string},
): PartnersURLs {
  let redirectUrlWhitelist: string[]
  if (authCallbackPath && authCallbackPath.length > 0) {
    const authCallbackPaths = Array.isArray(authCallbackPath) ? authCallbackPath : [authCallbackPath]
    redirectUrlWhitelist = authCallbackPaths.reduce<string[]>((acc, path) => {
      if (path && path.length > 0) {
        acc.push(`${baseURL}${path}`)
      }
      return acc
    }, [])
  } else {
    redirectUrlWhitelist = [
      `${baseURL}/auth/callback`,
      `${baseURL}/auth/shopify/callback`,
      `${baseURL}/api/auth/callback`,
    ]
  }

  const appProxy = proxyFields
    ? {
        appProxy: {
          proxyUrl: replaceHost(proxyFields.url, baseURL),
          proxySubPath: proxyFields.subpath,
          proxySubPathPrefix: proxyFields.prefix,
        },
      }
    : {}

  return {
    applicationUrl: baseURL,
    redirectUrlWhitelist,
    ...appProxy,
  }
}

function replaceHost(oldUrl: string, newUrl: string): string {
  const oldUrlObject = new URL(oldUrl)
  const newUrlObject = new URL(newUrl)
  oldUrlObject.host = newUrlObject.host
  return oldUrlObject.toString().replace(/\/$/, '')
}

export async function updateURLs(
  urls: PartnersURLs,
  apiKey: string,
  token: string,
  localApp?: AppConfigurationInterface,
): Promise<void> {
  const variables: UpdateURLsQueryVariables = {apiKey, ...urls}
  const query = UpdateURLsQuery
  const result: UpdateURLsQuerySchema = await partnersRequest(query, token, variables)
  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (localApp && isCurrentAppSchema(localApp.configuration) && localApp.configuration.client_id === apiKey) {
    const localConfiguration = {
      ...localApp.configuration,
      application_url: urls.applicationUrl,
      auth: {
        ...getPathValue(localApp.configuration, 'auth'),
        redirect_urls: urls.redirectUrlWhitelist,
      },
    }

    if (urls.appProxy) {
      setPathValue(localConfiguration, 'app_proxy', {
        url: urls.appProxy.proxyUrl,
        subpath: urls.appProxy.proxySubPath,
        prefix: urls.appProxy.proxySubPathPrefix,
      })
    }

    await writeAppConfigurationFile(localConfiguration, localApp.configSchema)
  }
}

export async function getURLs(apiKey: string, token: string): Promise<PartnersURLs> {
  const variables: GetURLsQueryVariables = {apiKey}
  const query = GetURLsQuery
  const response: GetURLsQuerySchema = await partnersRequest(query, token, variables)
  const appProxy = response.app.appProxy
  const result: PartnersURLs = {
    applicationUrl: response.app.applicationUrl,
    redirectUrlWhitelist: response.app.redirectUrlWhitelist,
  }
  if (appProxy) {
    result.appProxy = {
      proxyUrl: appProxy.url,
      proxySubPath: appProxy.subPath,
      proxySubPathPrefix: appProxy.subPathPrefix,
    }
  }
  return result
}

export interface ShouldOrPromptUpdateURLsOptions {
  currentURLs: PartnersURLs
  appDirectory: string
  cachedUpdateURLs?: boolean
  newApp?: boolean
  localApp?: AppInterface
  apiKey: string
}

export async function shouldOrPromptUpdateURLs(options: ShouldOrPromptUpdateURLsOptions): Promise<boolean> {
  if (options.localApp && options.localApp.configuration.client_id !== options.apiKey) return true
  if (options.newApp || !terminalSupportsRawMode()) return true
  let shouldUpdateURLs: boolean = options.cachedUpdateURLs === true

  if (options.cachedUpdateURLs === undefined) {
    shouldUpdateURLs = await updateURLsPrompt(
      options.currentURLs.applicationUrl,
      options.currentURLs.redirectUrlWhitelist,
    )

    if (options.localApp && isCurrentAppSchema(options.localApp.configuration)) {
      const localConfiguration = options.localApp.configuration
      setPathValue(localConfiguration, 'build', {
        ...(getPathValue(localConfiguration, 'build') ?? {}),
        automatically_update_urls_on_dev: shouldUpdateURLs,
      })
      await writeAppConfigurationFile(localConfiguration, options.localApp.configSchema)
    } else {
      setCachedAppInfo({directory: options.appDirectory, updateURLs: shouldUpdateURLs})
    }
  }
  return shouldUpdateURLs
}

export function validatePartnersURLs(urls: PartnersURLs): void {
  if (!isValidURL(urls.applicationUrl))
    throw new AbortError(`Invalid application URL: ${urls.applicationUrl}`, 'Valid format: "https://example.com"')

  urls.redirectUrlWhitelist.forEach((url) => {
    if (!isValidURL(url))
      throw new AbortError(
        `Invalid redirection URLs: ${urls.redirectUrlWhitelist}`,
        'Valid format: "https://example.com/callback1,https://example.com/callback2"',
      )
  })

  if (urls.appProxy?.proxyUrl && !isValidURL(urls.appProxy.proxyUrl)) {
    throw new AbortError(`Invalid app proxy URL: ${urls.appProxy.proxyUrl}`, 'Valid format: "https://example.com"')
  }
}

export async function startTunnelPlugin(config: Config, port: number, provider: string): Promise<TunnelClient> {
  const hooks = await fanoutHooks(config, 'tunnel_start', {port, provider})
  const results = Object.values(hooks).filter(
    (tunnelResponse) => !tunnelResponse?.isErr() || tunnelResponse.error.type !== 'invalid-provider',
  )
  if (results.length > 1) throw new BugError(`Multiple tunnel plugins for ${provider} found`)
  const first = results[0]
  if (!first) throw new BugError(`We couldn't find the ${provider} tunnel plugin`)
  if (first.isErr()) {
    throw new AbortError(`${provider} failed to start the tunnel.\n${first.error.message}`, [
      'What to try:',
      {
        list: {
          items: [
            ['Try to run the command again'],
            ['Add the flag', {command: '--tunnel-url {URL}'}, 'to use a custom tunnel URL'],
          ],
        },
      },
    ])
  }
  return first.value
}
