import {updateURLsPrompt} from '../../prompts/dev.js'
import {api, error, output, plugins, store} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

export interface PartnersURLs {
  applicationUrl: string
  redirectUrlWhitelist: string[]
}

export async function generateURL(pluginList: Plugin[], frontendPort: number): Promise<string> {
  const tunnelPlugin = await plugins.lookupTunnelPlugin(pluginList)
  if (!tunnelPlugin) throw new error.Bug('The tunnel could not be found')
  const url = await tunnelPlugin?.start({port: frontendPort})
  output.success('The tunnel is running and you can now view your app')
  return url
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
    store.cliKitStore().setAppInfo({directory: options.appDirectory, updateURLs: newUpdateURLs})
  }
  return shouldUpdate
}
