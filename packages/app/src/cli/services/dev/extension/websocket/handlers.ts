import {
  EventType,
  IncomingDispatchMessage,
  LogPayload,
  OutgoingDispatchMessage,
  OutgoingMessage,
  SetupWebSocketConnectionOptions,
} from './models.js'
import {getConsumer} from '../sourcemapping.js'
import {RawData, WebSocket, WebSocketServer} from 'ws'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {IncomingMessage} from 'http'
import {Duplex} from 'stream'

export function websocketUpgradeHandler(
  wss: WebSocketServer,
  options: SetupWebSocketConnectionOptions,
): (req: IncomingMessage, socket: Duplex, head: Buffer) => void {
  return (request, socket, head) => {
    if (request.url !== '/extensions') {
      return
    }
    outputDebug(`Upgrading HTTP request to a websocket connection`, options.stdout)
    wss.handleUpgrade(request, socket, head, getConnectionDoneHandler(wss, options))
  }
}

export function getConnectionDoneHandler(wss: WebSocketServer, options: SetupWebSocketConnectionOptions) {
  return (ws: WebSocket) => {
    outputDebug(`Websocket connection successfully established`, options.stdout)
    const connectedPayload = {
      event: 'connected',
      data: options.payloadStore.getConnectedPayload(),
      version: options.manifestVersion,
    }
    outputDebug(outputContent`Sending connected payload: ${outputToken.json(connectedPayload)}`, options.stdout)
    ws.send(JSON.stringify(connectedPayload))
    ws.on('message', getOnMessageHandler(wss, options))
  }
}

export function parseLogMessage(message: string, location: LogPayload['location']): string {
  let locationSuffix = ''
  if (location) {
    const originalLocation = getConsumer()?.originalPositionFor({
      line: location.line,
      column: location.column,
    })

    if (originalLocation) {
      // the first replace is to fix the source missing part of the path
      // the second is to reduce the length of the path, it could be further returned using a relative path
      const filepath = originalLocation.source
        ?.replace('/test-extensions/extensions/', '/test-extensions/matrix-mangoes/extensions/')
        .replace('/Users/henrystelle/', '~/')
      const filename = filepath?.split('/').pop()
      const lineColumnRef = `${originalLocation.line}:${originalLocation.column}`
      const link = outputToken.link(`${filename}:${lineColumnRef}`, `${filepath}:${lineColumnRef}`)
      locationSuffix = outputContent` at ${link}`.value
    }
  }

  try {
    const parsed = JSON.parse(message)

    // it is expected that the message is an array of console arguments
    if (!Array.isArray(parsed)) {
      return message
    }

    const formatted = parsed
      .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          return outputToken.json(arg).output()
        } else {
          return String(arg)
        }
      })
      .join(' ')

    return outputContent`${formatted}${locationSuffix}`.value
  } catch (error) {
    // If parsing fails, return the original message
    if (error instanceof SyntaxError) {
      return message
    }
    throw error
  }
}

const consoleTypeColors = {
  debug: (text: string) => outputToken.gray(text),
  warn: (text: string) => outputToken.yellow(text),
  error: (text: string) => outputToken.errorText(text),
} as const

function getOutput({type, message, location}: LogPayload) {
  const formattedMessage = parseLogMessage(message, location)

  switch (type) {
    case 'debug':
    case 'warn':
    case 'error':
      return outputContent`${consoleTypeColors[type](type.toUpperCase())}: ${formattedMessage}`.value
    case 'log':
    case 'info':
      return formattedMessage
    default:
      return `${type.toUpperCase()}: ${formattedMessage}`
  }
}

export function handleLogEvent(eventData: LogPayload, options: SetupWebSocketConnectionOptions) {
  useConcurrentOutputContext({outputPrefix: eventData.extensionName, stripAnsi: false}, () => {
    options.stdout.write(getOutput(eventData))
  })
}

export function getOnMessageHandler(wss: WebSocketServer, options: SetupWebSocketConnectionOptions) {
  return (data: RawData) => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const jsonData = JSON.parse(data.toString())
    const {event: eventType, data: eventData} = jsonData

    outputDebug(
      outputContent`Received websocket message with event type ${eventType} and data:
${outputToken.json(eventData)}
          `,
      options.stdout,
    )

    if (eventType === EventType.Update) {
      const payloadStoreApiKey = options.payloadStore.getRawPayload().app.apiKey
      const eventAppApiKey = eventData.app?.apiKey

      if (eventData.app) {
        if (payloadStoreApiKey !== eventAppApiKey) {
          return
        }
        /**
         * App updates must take precedence over extensions. Otherwise the websocket server
         * will send an update to the client with missing app data and will cause the loading
         * of extensions to fail.
         */
        options.payloadStore.updateApp(eventData.app)
      }
      if (eventData.extensions) {
        options.payloadStore.updateExtensions(eventData.extensions)
      }
    } else if (eventType === EventType.Dispatch) {
      const outGoingMessage = getOutgoingDispatchMessage(jsonData, options)

      notifyClients(wss, outGoingMessage, options)
    } else if (eventType === EventType.Log) {
      handleLogEvent(eventData, options)
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
      version: options.manifestVersion,
      data: {
        ...options.payloadStore.getRawPayloadFilteredByExtensionIds(extensionIds),
      },
    }
    outputDebug(
      outputContent`Sending websocket update event to the websocket clients:
  ${outputToken.json(payload)}
    `,
      options.stdout,
    )
    notifyClients(wss, payload, options)
  }
}

function notifyClients(wss: WebSocketServer, payload: OutgoingMessage, options: SetupWebSocketConnectionOptions) {
  outputDebug(
    outputContent`Sending websocket with event type ${payload.event} and data:
${outputToken.json(payload.data)}
        `,
    options.stdout,
  )

  const stringPayload = JSON.stringify(payload)
  wss.clients.forEach((ws) => ws.send(stringPayload))
}

function getOutgoingDispatchMessage(
  incomingMessage: IncomingDispatchMessage,
  options: SetupWebSocketConnectionOptions,
): OutgoingDispatchMessage {
  const extensionsPayload = options.payloadStore.getRawPayload()
  return {
    ...incomingMessage,
    version: options.manifestVersion,
    data: {
      ...incomingMessage.data,
      extensions: [],
      store: extensionsPayload.store,
      app: extensionsPayload.app,
    },
  }
}
