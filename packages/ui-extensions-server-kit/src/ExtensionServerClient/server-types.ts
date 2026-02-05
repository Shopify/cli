import {Surface} from './types.js'
import {ExtensionPayload, ExtensionPoint, App} from '../types'
import {FlattenedLocalization, LocalesOptions, Localization} from '../i18n'

// Re-export and augment the global ExtensionServer namespace
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
    locales?: LocalesOptions
  }

  export interface ServerEvents {
    event: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
  }

  export interface InboundEvents extends DispatchEvents {
    dispatch: {type: keyof DispatchEvents; payload: DispatchEvents[keyof DispatchEvents]}
    connected: {extensions: ExtensionPayload[]; app?: App; store: string}
    update: {extensions?: ExtensionPayload[]; app?: App}
  }

  export interface OutboundPersistEvents {
    update: {
      extensions?: ExtensionPayload[]
      app?: App
    }
  }

  export interface DispatchEvents {
    refresh: {uuid: string}[]
    focus: {uuid: string}[]
    unfocus: void
    navigate: {url: string}
  }

  export type EmitArgs<TEvent extends keyof DispatchEvents> = undefined extends DispatchEvents[TEvent]
    ? [event: TEvent]
    : [event: TEvent, payload: DispatchEvents[TEvent]]
}
