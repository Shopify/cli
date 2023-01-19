import {HookReturnPerTunnelPlugin} from './plugins/tunnel.js'
import {err, Result} from './result.js'
import {getArrayContainsDuplicates, getArrayRejectingUndefined} from '../common/array.js'
import {MonorailEventPublic, MonorailEventSensitive} from '../../monorail.js'
import {PickByPrefix} from '../common/ts/pick-by-prefix.js'
import {JsonMap} from '../../private/common/json.js'
import {Config, Interfaces} from '@oclif/core'

/**
 * Convenience function to trigger a hook, and gather any successful responses. Failures are ignored.
 *
 * Responses are organised into a dictionary, keyed by plug-in name. Only plug-ins that have hooks registered for the given event, and the hooks were run successfully, are included.
 *
 * @param config - The oclif config object.
 * @param event - The name of the hook to trigger.
 * @param options - The options to pass to the hook.
 * @param timeout - The timeout to use for the hook.
 * @returns A dictionary of plug-in names to the response from the hook.
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

type AppSpecificSensitiveMonorailFields = PickByPrefix<MonorailEventSensitive, 'app_'>

export interface HookReturnsPerPlugin extends HookReturnPerTunnelPlugin {
  public_command_metadata: {
    options: {[key: string]: never}
    pluginReturns: {
      '@shopify/app': Partial<AppSpecificMonorailFields>
      [pluginName: string]: JsonMap
    }
  }
  sensitive_command_metadata: {
    options: {[key: string]: never}
    pluginReturns: {
      '@shopify/app': Partial<AppSpecificSensitiveMonorailFields>
      [pluginName: string]: JsonMap
    }
  }
  [hookName: string]: {
    options: {[key: string]: unknown}
    pluginReturns: {[key: string]: unknown}
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
 * Fail if there are multiple plugins for the same provider.
 *
 * @param config - Oclif config used to execute hooks.
 * @returns List of available tunnel plugins.
 */
export async function getListOfTunnelPlugins(config: Config): Promise<{plugins: string[]; error?: string}> {
  const hooks = await fanoutHooks(config, 'tunnel_provider', {})
  const names = getArrayRejectingUndefined(Object.values(hooks).map((key) => key?.name))
  if (getArrayContainsDuplicates(names)) return {plugins: names, error: 'multiple-plugins-for-provider'}
  return {plugins: names}
}

export interface TunnelPluginError {
  provider: string
  type: 'multiple-urls' | 'handled-error' | 'unknown' | 'no-provider'
  message?: string
}

/**
 * Execute the 'tunnel_start' hook for the given provider.
 * Fails if there aren't plugins for that provider or if there are more than one.
 *
 * @param config - Oclif config used to execute hooks.
 * @param port - Port where the tunnel will be started.
 * @param provider - Selected provider, must be unique.
 * @returns Tunnel URL from the selected provider.
 */
export async function runTunnelPlugin(
  config: Config,
  port: number,
  provider: string,
): Promise<Result<string, TunnelPluginError>> {
  const hooks = await fanoutHooks(config, 'tunnel_start', {port, provider})
  const urlResults = Object.values(hooks).filter(
    (tunnelResponse) => !tunnelResponse?.isErr() || tunnelResponse.error.type !== 'invalid-provider',
  )
  if (urlResults.length > 1) return err({provider, type: 'multiple-urls'})
  if (urlResults.length === 0 || !urlResults[0]) return err({provider, type: 'no-provider'})

  return urlResults[0]
    .map((data) => data.url)
    .mapError((error) =>
      error.type === 'unknown'
        ? {provider, type: 'unknown', message: error.message}
        : {provider, type: 'handled-error'},
    )
}
