/* eslint-disable @typescript-eslint/naming-convention */
import {join, pathToFileURL} from './path.js'
import {debug, content} from './output.js'
import {Schemas} from './monorail.js'
import {Interfaces} from '@oclif/core'

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

interface HookReturnsPerPlugin {
  public_command_metadata: {
    options: {[key: string]: never}
    pluginReturns: {
      '@shopify/app': Partial<
        Pick<Schemas['app_cli3_command/1.0']['public'], 'project_type' | 'api_key' | 'partner_id'> & {
          [key: string]: unknown
        }
      >
      [pluginName: string]: {[key: string]: unknown}
    }
  }
  [hookName: string]: {
    options: {[key: string]: unknown}
    pluginReturns: {[key: string]: {[key: string]: unknown}}
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
) => Promise<Partial<PluginReturnsForHook<TEvent, TPluginName, TPluginMap>>>
