import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from '../payload/store.js'
import {Server} from 'http'

export enum EventType {
  Update = 'update',
  Dispatch = 'dispatch',
  Log = 'log',
}

type DataType = 'focus' | 'unfocus'

type DataPayload = {uuid: string}[]

export type SetupWebSocketConnectionOptions = ExtensionsPayloadStoreOptions & {
  httpServer: Server
  payloadStore: ExtensionsPayloadStore
}

export interface WebsocketConnection {
  close: () => void
}

export interface IncomingDispatchMessage {
  event: EventType.Dispatch
  data: {
    type: DataType
    payload?: DataPayload
  }
}

export interface OutgoingDispatchMessage extends OutgoingMessage {
  event: EventType.Dispatch
  data: {
    type: DataType
    payload?: DataPayload
    extensions: unknown[]
    store: string
    app: {apiKey: string}
  }
}
export interface OutgoingMessage {
  event: EventType
  version: string
  data: {[key: string]: unknown}
}

export interface LogPayload {
  type: string
  message: string
  extensionName: string
}
