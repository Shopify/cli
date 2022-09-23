import {
  EventType,
  IncomingDispatchMessage,
  OutgoingDispatchMessage,
  OutgoingMessage,
  SetupWebSocketConnectionOptions,
} from './models.js'
import {RawData, WebSocket, WebSocketServer} from 'ws'
import {http, output} from '@shopify/cli-kit'
import {Duplex} from 'stream'

export function websocketUpgradeHandler(
  wss: WebSocketServer,
  options: SetupWebSocketConnectionOptions,
): (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void {
  return (request, socket, head) => {
    if (request.url !== '/extensions') {
      return
    }
    output.debug(`Upgrading HTTP request to a websocket connection`)
    wss.handleUpgrade(request, socket, head, getConnectionDoneHandler(wss, options))
  }
}

export function getConnectionDoneHandler(wss: WebSocketServer, options: SetupWebSocketConnectionOptions) {
  return (ws: WebSocket) => {
    output.debug(`Websocket connection successfully established`)
    const connectedPayload = {
      event: 'connected',
      data: options.payloadStore.getConnectedPayload(),
      version: '3',
    }
    output.debug(output.content`Sending connected payload: ${output.token.json(connectedPayload)}`)
    ws.send(JSON.stringify(connectedPayload))
    ws.on('message', getOnMessageHandler(wss, options))
  }
}

export function getOnMessageHandler(wss: WebSocketServer, options: SetupWebSocketConnectionOptions) {
  return (data: RawData) => {
    const jsonData = JSON.parse(data.toString())
    const {event: eventType, data: eventData} = jsonData

    output.debug(output.content`Received websocket message with event type ${eventType} and data:
${output.token.json(eventData)}
          `)

    if (eventType === 'update') {
      /**
       * App updates must take precedence over extensions. Otherwise the websocket server
       * will send an update to the client with missing app data and will cause the loading
       * of extensions to fail.
       */
      if (eventData.app) {
        options.payloadStore.updateApp(eventData.app)
      }
      if (eventData.extensions) {
        options.payloadStore.updateExtensions(eventData.extensions)
      }
    } else if (eventType === 'dispatch') {
      const outGoingMessage = getOutgoingDispatchMessage(jsonData, options)

      notifyClients(wss, outGoingMessage)
    }
  }
}

export function getPayloadUpdateHandler(
  wss: WebSocketServer,
  options: SetupWebSocketConnectionOptions,
): (extensionIds: string[]) => void {
  return (extensionIds: string[]) => {
    const payload = {
      event: EventType.Update,
      version: '3',
      data: {
        ...options.payloadStore.getRawPayloadFilteredByExtensionIds(extensionIds),
      },
    }
    output.debug(output.content`Sending websocket update event to the websocket clients:
  ${output.token.json(payload)}
    `)
    notifyClients(wss, payload)
  }
}

function notifyClients(wss: WebSocketServer, payload: OutgoingMessage) {
  output.debug(output.content`Sending websocket with event type ${payload.event} and data:
${output.token.json(payload.data)}
        `)

  const stringPayload = JSON.stringify(payload)
  wss.clients.forEach((ws) => ws.send(stringPayload))
}

export function getOutgoingDispatchMessage(
  incomingMessage: IncomingDispatchMessage,
  options: SetupWebSocketConnectionOptions,
): OutgoingDispatchMessage {
  const extensionsPayload = options.payloadStore.getRawPayload()
  return {
    ...incomingMessage,
    version: '3',
    data: {
      ...incomingMessage.data,
      extensions: [],
      store: extensionsPayload.store,
      app: extensionsPayload.app,
    },
  }
}
