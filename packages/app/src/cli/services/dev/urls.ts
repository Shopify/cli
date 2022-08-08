import {updateURLsPrompt} from '../../prompts/dev.js'
import {api, error, output, plugins, store} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

export async function generateURL(pluginList: Plugin[], frontendPort: number): Promise<string> {
  const tunnelPlugin = await plugins.lookupTunnelPlugin(pluginList)
  if (!tunnelPlugin) throw new error.Bug('The tunnel could not be found')
  const url = await tunnelPlugin?.start({port: frontendPort})
  output.success('The tunnel is running and you can now view your app')
  return url
}

export async function updateURLs(apiKey: string, url: string, token: string): Promise<void> {
  const variables: api.graphql.UpdateURLsQueryVariables = {
    apiKey,
    appUrl: url,
    redir: [`${url}/auth/callback`, `${url}/auth/shopify/callback`, `${url}/api/auth/callback`],
  }

  const query = api.graphql.UpdateURLsQuery
  const result: api.graphql.UpdateURLsQuerySchema = await api.partners.request(query, token, variables)
  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }
}

export async function getURLs(apiKey: string, token: string): Promise<{appURL: string; redir: string[]}> {
  const variables: api.graphql.GetURLsQueryVariables = {apiKey}
  const query = api.graphql.GetURLsQuery
  const result: api.graphql.GetURLsQuerySchema = await api.partners.request(query, token, variables)
  return {appURL: result.app.applicationUrl, redir: result.app.redirectUrlWhitelist}
}

export async function shouldUpdateURLs(
  cachedUpdateURLs: boolean | undefined,
  apiKey: string,
  directory: string,
  token: string,
  newApp: boolean | undefined,
): Promise<boolean> {
  if (newApp) return true
  let shouldUpdate: boolean = cachedUpdateURLs === true
  if (cachedUpdateURLs === undefined) {
    const {appURL} = await getURLs(apiKey, token)
    output.info(`Your app's URL currently is: ${appURL}`)
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
    store.cliKitStore().setAppInfo({appId: apiKey, directory, updateURLs: newUpdateURLs})
  }
  return shouldUpdate
}
