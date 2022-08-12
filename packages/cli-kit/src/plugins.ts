import {JsonMap} from './json.js'
import {PickByPrefix} from './typing/pick-by-prefix.js'
import {MonorailEventPublic} from './monorail.js'
import {HookReturnPerTunnelPlugin} from './plugins/tunnel.js'
import {containsDuplicates, filterUndefined} from './array.js'
import {Config, Interfaces} from '@oclif/core'

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

export type PluginReturnsForHook<
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
 * Execute the 'tunnel_provider' hook, and return the list of available tunnel providers.
 */
export async function getListOfTunnelPlugins(config: Config): Promise<{plugins: string[]; error?: string}> {
  const hooks = await fanoutHooks(config, 'tunnel_provider', {})
  const names = filterUndefined(Object.values(hooks).map((key) => key?.name))
  if (containsDuplicates(names)) {
    return {plugins: names, error: 'multiple-plugins-for-provider'}
  }
  return {plugins: names}
}

/**
 * Execute the 'tunnel_start' hook for the given provider.
 * Fail if there aren't plugins for that provider or if there are more than one.
 */
export async function runTunnelPlugin(
  config: Config,
  port: number,
  provider: string,
): Promise<{url?: string; error?: string}> {
  const hooks = await fanoutHooks(config, 'tunnel_start', {port, provider})
  const urls = filterUndefined(Object.values(hooks).map((key) => key?.url))
  if (urls.length > 1) return {error: 'multiple-urls'}
  if (urls.length === 0) return {error: 'no-urls'}
  return {url: urls[0]}
}
