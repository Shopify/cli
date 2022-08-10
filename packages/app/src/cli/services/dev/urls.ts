import {api, error, output, ui} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {lookupTunnelPlugins, startTunnel, TunnelPlugin} from '@shopify/cli-kit/src/plugins.js'

export async function generateURL(config: Config, frontendPort: number, tunnelFlag?: string): Promise<string> {
  // List of plugins that support tunneling
  const tunnelPlugins = await lookupTunnelPlugins(config)
  if (tunnelPlugins.length === 0) throw new error.Bug('No tunnel plugins detected')

  // Select a plugin from the list, either via flag or prompt
  const selectedPlugin = await selectTunnelPlugin(tunnelPlugins, tunnelFlag)

  // Start the tunnel from the selected plugin
  const tunnelURL = await startTunnel(config, selectedPlugin.hookName, frontendPort)

  // Should we show this error or let the plugins handle the output and fail silently here?
  if (!tunnelURL) throw new error.Bug(`Error obtaining tunnel URL from plugin: ${selectedPlugin.name}`)

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

async function selectTunnelPlugin(plugins: TunnelPlugin[], tunnelFlag?: string): Promise<TunnelPlugin> {
  if (tunnelFlag) {
    const plugin = plugins.find((plugin) => plugin.name === tunnelFlag)
    if (!plugin) throw new error.Abort(`Tunnel plugin "${tunnelFlag}" not found`)
    return plugin
  } else if (plugins.length === 1) {
    return plugins[0]
  } else {
    return promptTunnelOptions(plugins)
  }
}

async function promptTunnelOptions(plugins: TunnelPlugin[]): Promise<TunnelPlugin> {
  const hookList = plugins.map((plugin) => ({name: plugin.name, value: plugin.hookName}))
  const choice = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: 'We detected multiple tunnel plugins, which one do you want to use?',
      choices: hookList,
    },
  ])
  return plugins.find((plugin) => plugin.hookName === choice.value)!
}
