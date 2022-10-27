import {JsonMap} from './json.js'
import {PickByPrefix} from './typing/pick-by-prefix.js'
import {MonorailEventPublic, MonorailEventSensitive} from './monorail.js'
import {HookReturnPerTunnelPlugin} from './public/node/plugins/tunnel.js'
import {getArrayContainsDuplicates, getArrayRejectingUndefined} from './public/common/array.js'
import {err, Result} from './public/common/result.js'
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

type AppSpecificSensitiveMonorailFields = PickByPrefix<MonorailEventSensitive, 'app_'>

interface HookReturnsPerPlugin extends HookReturnPerTunnelPlugin {
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
    pluginReturns: {[key: string]: JsonMap | Result<JsonMap, Error>}
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
 * Fail if there are multiple plugins for the same provider
 *
 * @param config - oclif config used to execute hooks
 * @returns list of available tunnel plugins
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
 * @param config - oclif config used to execute hooks
 * @param port - port where the tunnel will be started
 * @param provider - selected provider, must be unique
 * @returns tunnel URL from the selected provider
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
