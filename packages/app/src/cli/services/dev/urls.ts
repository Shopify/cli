import {tunnelConfigurationPrompt, updateURLsPrompt} from '../../prompts/dev.js'
import {AppInterface} from '../../models/app/app.js'
import {api, environment, error, output, plugins, port, store} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {codesandboxHost} from '@shopify/cli-kit/src/environment/local.js'

export interface PartnersURLs {
  applicationUrl: string
  redirectUrlWhitelist: string[]
}

export interface FrontendURLOptions {
  app: AppInterface
  tunnel: boolean
  noTunnel: boolean
  tunnelUrl?: string
  cachedTunnelPlugin?: string
  commandConfig: Config
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
 * - If a tunnelUrl is provided, that takes preference and is returned as the frontendURL
 * - If noTunnel is true, that takes second preference and localhost is used
 * - A Tunnel is created then if any of these conditions are met:
 *   - Tunnel flag is true
 *   - The app has UI extensions
 *   - In a previous run, the user selected to always use a tunnel (cachedTunnelPlugin)
 * - Otherwise, localhost is used
 *
 * If there is no cached tunnel plugin and a tunnel is necessary, we'll ask the user to confirm.
 */
export async function generateFrontendURL(options: FrontendURLOptions): Promise<FrontendURLResult> {
  let frontendPort = 4040
  let frontendUrl: string
  let usingLocalhost = false
  const hasExtensions = options.app.hasUIExtensions()

  const needsTunnel = (hasExtensions || options.tunnel || options.cachedTunnelPlugin) && !options.noTunnel

  if (environment.local.codesandboxHost()) {
    frontendUrl = `https://${codesandboxHost}.codesandbox.io`
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (environment.local.codespaceURL()) {
    frontendUrl = `https://${environment.local.codespaceURL()}-${frontendPort}.githubpreview.dev`
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (environment.local.gitpodURL()) {
    const defaultUrl = environment.local.gitpodURL()?.replace('https://', '')
    frontendUrl = `https://${frontendPort}-${defaultUrl}`
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (options.tunnelUrl) {
    const matches = options.tunnelUrl.match(/(https:\/\/[^:]+):([0-9]+)/)
    if (!matches) {
      throw new error.Abort(`Invalid tunnel URL: ${options.tunnelUrl}`, 'Valid format: "https://my-tunnel-url:port"')
    }
    frontendPort = Number(matches[2])
    frontendUrl = matches[1]!
    return {frontendUrl, frontendPort, usingLocalhost}
  }

  if (needsTunnel && !options.cachedTunnelPlugin) {
    let message = "We'll run your tunnel with ngrok."
    const extensionsWarning = 'Some parts of your app can only be previewed with a tunnel to your dev store.'
    if (hasExtensions) message = `${extensionsWarning} ${message}`

    output.info(`\n${message}\n`)

    const useTunnel = await tunnelConfigurationPrompt()
    if (useTunnel === 'cancel') throw new error.CancelExecution()
    if (useTunnel === 'always') {
      await store.setAppInfo({directory: options.app.directory, tunnelPlugin: 'ngrok'})
    }
  }

  if (needsTunnel) {
    frontendPort = await port.getRandomPort()
    frontendUrl = await generateURL(options.commandConfig, frontendPort)
  } else {
    frontendPort = await port.getRandomPort()
    frontendUrl = 'http://localhost'
    usingLocalhost = true
  }

  return {frontendUrl, frontendPort, usingLocalhost}
}

export async function generateURL(config: Config, frontendPort: number): Promise<string> {
  // For the moment we assume to always have ngrok, this will change in a future PR
  // and will need to use "getListOfTunnelPlugins" to find the available tunnel plugins
  const result = await plugins.runTunnelPlugin(config, frontendPort, 'ngrok')

  if (result.error === 'multiple-urls') throw new error.Bug('Multiple tunnel plugins for ngrok found')
  if (result.error === 'no-urls' || !result.url) throw new error.Bug('Ngrok failed to start the tunnel')
  output.success('The tunnel is running and you can now view your app')
  return result.url
}

export function generatePartnersURLs(baseURL: string): PartnersURLs {
  return {
    applicationUrl: baseURL,
    redirectUrlWhitelist: [
      `${baseURL}/auth/callback`,
      `${baseURL}/auth/shopify/callback`,
      `${baseURL}/api/auth/callback`,
    ],
  }
}

export async function updateURLs(urls: PartnersURLs, apiKey: string, token: string): Promise<void> {
  const variables: api.graphql.UpdateURLsQueryVariables = {apiKey, ...urls}
  const query = api.graphql.UpdateURLsQuery
  const result: api.graphql.UpdateURLsQuerySchema = await api.partners.request(query, token, variables)
  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }
}

export async function getURLs(apiKey: string, token: string): Promise<PartnersURLs> {
  const variables: api.graphql.GetURLsQueryVariables = {apiKey}
  const query = api.graphql.GetURLsQuery
  const result: api.graphql.GetURLsQuerySchema = await api.partners.request(query, token, variables)
  return {applicationUrl: result.app.applicationUrl, redirectUrlWhitelist: result.app.redirectUrlWhitelist}
}

export interface ShouldOrPromptUpdateURLsOptions {
  currentURLs: PartnersURLs
  appDirectory: string
  cachedUpdateURLs?: boolean
  newApp?: boolean
}

export async function shouldOrPromptUpdateURLs(options: ShouldOrPromptUpdateURLsOptions): Promise<boolean> {
  if (options.newApp) return true
  let shouldUpdate: boolean = options.cachedUpdateURLs === true
  if (options.cachedUpdateURLs === undefined) {
    output.info(`\nYour app's URL currently is:\n  ${options.currentURLs.applicationUrl}`)
    output.info(`\nYour app's redirect URLs currently are:`)
    options.currentURLs.redirectUrlWhitelist.forEach((url) => output.info(`  ${url}`))
    output.newline()
    const response = await updateURLsPrompt()
    let newUpdateURLs: boolean | undefined
    /* eslint-disable no-fallthrough */
    switch (response) {
      case 'always':
        newUpdateURLs = true
      case 'yes':
        shouldUpdate = true
        break
      case 'never':
        newUpdateURLs = false
      case 'no':
        shouldUpdate = false
    }
    /* eslint-enable no-fallthrough */
    await store.setAppInfo({directory: options.appDirectory, updateURLs: newUpdateURLs})
  }
  return shouldUpdate
}
