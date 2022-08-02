import {join, pathToFileURL} from './path.js'
import {debug, content} from './output.js'
import {Plugin, Config, Hooks} from '@oclif/core/lib/interfaces'

const TUNNEL_PLUGINS = ['@shopify/plugin-ngrok']

interface TunnelPlugin {
  start: (options: TunnelStartOptions) => Promise<string>
}

interface TunnelStartOptions {
  port: number
}

export async function lookupTunnelPlugin(plugins: Plugin[]): Promise<TunnelPlugin | undefined> {
  debug(content`Looking up the Ngrok tunnel plugin...`)
  const tunnelPlugin = plugins.find((plugin) => TUNNEL_PLUGINS.includes(plugin.name))
  if (!tunnelPlugin) return undefined
  const tunnelPath = pathToFileURL(join(tunnelPlugin.root, 'dist/tunnel.js')).toString()
  return import(tunnelPath).catch(() => undefined)
}

/**
 * Convenience function to trigger a hook, and gather any successful responses. Failures are ignored.
 *
 * Responses are organised into a dictionary, keyed by plug-in name. Only plug-ins that have hooks registered for the given event, and the hooks were run successfully, are included.
 */
export async function fanoutHooks<T extends keyof Hooks, TResult = Hooks[T]['return']>(
  config: Config,
  event: T,
  options: Hooks[T]['options'],
  timeout?: number,
): Promise<{[pluginName: string]: TResult}> {
  const res = await config.runHook(event, options, timeout)
  return Object.fromEntries(res.successes.map(({result, plugin}) => [plugin.name, result]))
}
