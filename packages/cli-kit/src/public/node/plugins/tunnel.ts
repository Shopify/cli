import {ExtendableError} from '../error.js'
import {OutputMessage} from '../output.js'
import {FanoutHookFunction, PluginReturnsForHook} from '../plugins.js'
import {err, Result} from '../result.js'
import {TokenItem} from '../ui.js'

export type TunnelErrorType = 'invalid-provider' | 'tunnel-already-running' | 'wrong-credentials' | 'unknown'
export interface TunnelClient {
  getTunnelStatus: () => TunnelStatusType
  stopTunnel: () => void
  provider: string
  port: number
}
export type TunnelStatusType =
  | {status: 'not-started'}
  | {status: 'starting'}
  | {status: 'connected'; url: string}
  | {status: 'error'; message: TokenItem | OutputMessage; tryMessage?: TokenItem | OutputMessage | null}

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
    options: {port: number; provider: string; tunnelUrl: string; tunnelSecret: string; tunnelId: string}
    pluginReturns: {
      [key: string]: Result<TunnelClient, TunnelError>
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
export type TunnelStartAction = (
  port: number,
  tunnelUrl: string,
  tunnelSecret: string,
  tunnelId: string,
) => Promise<TunnelStartReturn>

export const defineProvider = (input: {name: string}): TunnelProviderFunction => {
  return async () => input
}

export const startTunnel = (options: {provider: string; action: TunnelStartAction}): TunnelStartFunction => {
  return async (inputs: {
    provider: string
    port: number
    tunnelUrl: string
    tunnelSecret: string
    tunnelId: string
  }): Promise<TunnelStartReturn> => {
    if (inputs.provider !== options.provider) return err(new TunnelError('invalid-provider'))
    return options.action(inputs.port, inputs.tunnelUrl, inputs.tunnelSecret, inputs.tunnelId)
  }
}
