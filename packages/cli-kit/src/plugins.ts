import {join, pathToFileURL} from './path.js'
import {debug, content} from './output.js'
import {JsonMap} from './json.js'
import {PickByPrefix} from './typing/pick-by-prefix.js'
import {MonorailEventPublic} from './monorail.js'
import {Interfaces, Config} from '@oclif/core'

const TUNNEL_PLUGINS = ['@shopify/plugin-ngrok']

interface TunnelPlugin {
  start: (options: TunnelStartOptions) => Promise<string>
}

interface TunnelStartOptions {
  port: number
}

export async function lookupTunnelPlugin(plugins: Interfaces.Plugin[]): Promise<TunnelPlugin | undefined> {
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
export async function fanoutHooks<TPluginMap extends HookReturnsPerPlugin, TEvent extends string & keyof TPluginMap>(
  config: Interfaces.Config,
  event: TEvent,
  options: TPluginMap[typeof event]['options'],
  timeout?: number,
): Promise<Partial<TPluginMap[typeof event]['pluginReturns']>> {
  const res = await config.runHook(event, options, timeout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.fromEntries(res.successes.map(({result, plugin}) => [plugin.name, result])) as any
}

type AppSpecificMonorailFields = PickByPrefix<MonorailEventPublic, 'app_', 'project_type' | 'api_key' | 'partner_id'> &
  PickByPrefix<MonorailEventPublic, 'cmd_extensions_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_scaffold_'>

interface HookReturnsPerPlugin extends HookReturnPerTunnelPlugin {
  public_command_metadata: {
    options: {[key: string]: never}
    pluginReturns: {
      '@shopify/app': Partial<AppSpecificMonorailFields>
      [pluginName: string]: JsonMap
    }
  }
  [hookName: string]: {
    options: {[key: string]: unknown}
    pluginReturns: {[key: string]: JsonMap}
  }
}

type PluginReturnsForHook<
  TEvent extends keyof TPluginMap,
  TPluginName extends keyof TPluginMap[TEvent]['pluginReturns'],
  TPluginMap extends HookReturnsPerPlugin = HookReturnsPerPlugin,
> = TPluginMap[TEvent]['pluginReturns'][TPluginName]

export type FanoutHookFunction<
  TEvent extends keyof TPluginMap = string,
  TPluginName extends keyof TPluginMap[TEvent]['pluginReturns'] = string,
  TPluginMap extends HookReturnsPerPlugin = HookReturnsPerPlugin,
> = (
  this: Interfaces.Hook.Context,
  options: TPluginMap[TEvent]['options'] & {config: Interfaces.Config},
) => Promise<PluginReturnsForHook<TEvent, TPluginName, TPluginMap>>

/**
 * Tunnel Plugins types
 */
interface HookReturnPerTunnelPlugin {
  tunnel_start: {
    options: {port: number; provider: string}
    pluginReturns: {
      [pluginName: string]: {url: string | undefined}
    }
  }
  tunnel_provider: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: {name: string}
    }
  }
}

export type TunnelProviderFunction = FanoutHookFunction<'tunnel_provider', ''>
export type TunnelStartFunction = FanoutHookFunction<'tunnel_start', ''>
export type TunnelStartReturn = PluginReturnsForHook<'tunnel_start', ''>
export type TunnelStartAction = (port: number) => Promise<TunnelStartReturn>

export const tunnel = {
  defineProvider: (input: {name: string}): TunnelProviderFunction => {
    return async () => input
  },
  startTunnel: (options: {provider: string; action: TunnelStartAction}): TunnelStartFunction => {
    return async (inputs: {provider: string; port: number}): Promise<TunnelStartReturn> => {
      if (inputs.provider !== options.provider) return {url: undefined}
      return options.action(inputs.port)
    }
  },
}
