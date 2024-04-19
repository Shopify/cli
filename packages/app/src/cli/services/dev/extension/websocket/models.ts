import {ExtensionsPayloadStore} from '../payload/store.js'
import {ExtensionDevOptions} from '../../extension.js'
import {Server} from 'http'

export enum EventType {
  Update = 'update',
  Dispatch = 'dispatch',
}

type DataType = 'focus' | 'unfocus'

type DataPayload = {uuid: string}[]

export type SetupWebSocketConnectionOptions = ExtensionDevOptions & {
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
