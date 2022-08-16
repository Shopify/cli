import {FanoutHookFunction, PluginReturnsForHook} from '../plugins.js'

/**
 * Tunnel Plugins types
 *
 * Any plugin that provides tunnel functionality should implement `defineProvider`and `startTunnel`
 */
export interface HookReturnPerTunnelPlugin {
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

export const defineProvider = (input: {name: string}): TunnelProviderFunction => {
  return async () => input
}
export const startTunnel = (options: {provider: string; action: TunnelStartAction}): TunnelStartFunction => {
  return async (inputs: {provider: string; port: number}): Promise<TunnelStartReturn> => {
    if (inputs.provider !== options.provider) return {url: undefined}
    return options.action(inputs.port)
  }
}
