import {ExtensionsPayloadStoreEvent} from './payload/store.js'
import {SetupWebSocketConnectionOptions, WebsocketConnection} from './websocket/models.js'
import {getPayloadUpdateHandler, websocketUpgradeHandler} from './websocket/handlers.js'
import {WebSocketServer} from 'ws'

const PING_INTERVAL_SEC = 10

export function setupWebsocketConnection(options: SetupWebSocketConnectionOptions): WebsocketConnection {
  const wss = new WebSocketServer({noServer: true, clientTracking: true})
  const timer = pingAliveClientsPeriodically(wss)

  options.httpServer.on('upgrade', websocketUpgradeHandler(wss, options))
  options.payloadStore.on(ExtensionsPayloadStoreEvent.Update, getPayloadUpdateHandler(wss, options))

  return {
    close: () => {
      wss.close()
      clearInterval(timer)
    },
  }
}
function pingAliveClientsPeriodically(wss: WebSocketServer) {
  return setInterval(() => {
    wss.clients.forEach((ws) => {
      const connectionAlive = ws.readyState < 2
      if (connectionAlive) {
        ws.ping()
      }
    })
  }, PING_INTERVAL_SEC * 1000)
}
