import {Surface} from './types.js'
import {ExtensionPayload, ExtensionPoint} from '../types'
import {FlattenedLocalization, Localization} from '../i18n'

export namespace ExtensionServer {
  export interface UIExtension extends ExtensionPayload {
    extensionPoints: ExtensionPoint[]
    localization?: FlattenedLocalization | Localization | null
  }

  export interface Client {
    id: string
    connection: WebSocket
    options: Options
    connect(options?: Options): () => void
    on<TEvent extends keyof InboundEvents>(
      event: TEvent,
      listener: (payload: InboundEvents[TEvent]) => void,
    ): () => void
    persist<TEvent extends keyof OutboundPersistEvents>(event: TEvent, data: OutboundPersistEvents[TEvent]): void
    emit<TEvent extends keyof DispatchEvents>(...args: EmitArgs<TEvent>): void
    onConnection<TEvent extends 'close' | 'open'>(event: TEvent, listener: (event: Event) => void): () => void
  }

  export interface Options {
    connection: {
      url?: string
      automaticConnect?: boolean
      protocols?: string | string[]
    }
    surface?: Surface
    locales?: any
  }

  export interface ServerEvents {
    event: string
    data: any
  }

  export interface InboundEvents {
    [key: string]: any
  }

  export interface OutboundPersistEvents {
    [key: string]: any
  }

  export interface DispatchEvents {
    [key: string]: any
  }

  export type EmitArgs<TEvent extends keyof DispatchEvents> = undefined extends DispatchEvents[TEvent]
    ? [event: TEvent]
    : [event: TEvent, payload: DispatchEvents[TEvent]]
}
