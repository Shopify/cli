import {err, Result} from '../result.js'
import {ExtendableError} from '../error.js'
import {FanoutHookFunction, PluginReturnsForHook} from '../plugins.js'

export type TunnelErrorType = 'invalid-provider' | 'tunnel-already-running' | 'wrong-credentials' | 'unknown'
export type TunnelStatusType =
  | {status: 'not-started'}
  | {status: 'starting'}
  | {status: 'connected'; url: string}
  | {status: 'error'; message: string}

export class TunnelError extends ExtendableError {
  type: TunnelErrorType
  constructor(type: TunnelErrorType, message?: string) {
    super(message)
    this.type = type
  }
}

/**
 * Tunnel Plugins types
 *
 * Any plugin that provides tunnel functionality should implement `defineProvider`and `startTunnel`
 */
export interface HookReturnPerTunnelPlugin {
  tunnel_start: {
    options: {port: number; provider: string}
    pluginReturns: {[key: string]: unknown}
  }
  tunnel_stop: {
    options: {provider: string}
    pluginReturns: {[key: string]: unknown}
  }
  tunnel_status: {
    options: {provider: string}
    pluginReturns: {
      [pluginName: string]: Result<TunnelStatusType, TunnelError>
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
export type TunnelStopFunction = FanoutHookFunction<'tunnel_start', ''>
export type TunnelStatusFunction = FanoutHookFunction<'tunnel_status', ''>

export type TunnelStartReturn = PluginReturnsForHook<'tunnel_start', ''>
export type TunnelStopReturn = PluginReturnsForHook<'tunnel_start', ''>
export type TunnelStatusReturn = PluginReturnsForHook<'tunnel_status', ''>

export type TunnelStartAction = (port: number) => Promise<TunnelStartReturn>
export type TunnelStatusAction = () => TunnelStatusReturn
export type TunnelStopAction = () => TunnelStopReturn

export const defineProvider = (input: {name: string}): TunnelProviderFunction => {
  return async () => input
}

export const startTunnel = (options: {provider: string; action: TunnelStartAction}): TunnelStartFunction => {
  return async (inputs: {provider: string; port: number}): Promise<TunnelStartReturn> => {
    if (inputs.provider !== options.provider) return err(new TunnelError('invalid-provider'))
    return options.action(inputs.port)
  }
}

export const stopTunnel = (options: {provider: string; action: TunnelStopAction}): TunnelStopFunction => {
  return async (inputs: {provider: string; port: number}): Promise<TunnelStopReturn> => {
    if (inputs.provider !== options.provider) return err(new TunnelError('invalid-provider'))
    return options.action()
  }
}

export const tunnelStatus = (options: {provider: string; action: TunnelStatusAction}): TunnelStatusFunction => {
  return async (inputs: {provider: string}): Promise<TunnelStatusReturn> => {
    if (inputs.provider !== options.provider) return err(new TunnelError('invalid-provider'))
    return options.action()
  }
}
