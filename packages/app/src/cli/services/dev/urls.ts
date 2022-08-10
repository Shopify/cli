import {api, error, output, plugins, ui} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {TunnelHook} from '@shopify/cli-kit/src/plugins.js'

export async function generateURL(config: Config, frontendPort: number, tunnelFlag?: string): Promise<string> {
  // List of plugins that support tunneling
  const hookResult = await plugins.fanoutHooks(config, 'tunnel_provider', {})
  const tunnelPlugins = Object.values(hookResult).flatMap((plugin) => (plugin ? [plugin] : []))

  if (tunnelPlugins.length === 0) throw new error.Bug('No tunnel plugins detected')

  let selectedHook = tunnelPlugins[0].hookName
  if (tunnelFlag) {
    const hookFromFlag = tunnelPlugins.find((plugin) => plugin.name === tunnelFlag)?.hookName
    if (!hookFromFlag) throw new error.Abort(`Tunnel plugin "${tunnelFlag}" not found`)
    selectedHook = hookFromFlag
  } else if (tunnelPlugins.length > 1) {
    selectedHook = await promptTunnelOptions(tunnelPlugins)
  }

  const pluginName = tunnelPlugins.find((plugin) => plugin.hookName === selectedHook)?.name

  // Generated tunnel URLs, should only be one but hooks will always return an map
  const tunnelURLs = await plugins.fanoutHooks(config, selectedHook, {port: frontendPort})

  const tunnelURL = tunnelURLs[Object.keys(tunnelURLs)[0]]?.url

  // Should we show this error or let the plugins handle the output and fail silently here?
  if (!tunnelURL) throw new error.Bug(`Error obtaining tunnel URL from plugin: ${pluginName}`)

  output.success('The tunnel is running and you can now view your app')
  return tunnelURL
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

async function promptTunnelOptions(options: {hookName: TunnelHook; name: string}[]): Promise<TunnelHook> {
  const hookList = options.map((option) => ({name: option.name, value: option.hookName}))
  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'We detected multiple tunnel plugins, which one do you want to use?',
      choices: hookList,
    },
  ])
  return choice.value as TunnelHook
}
