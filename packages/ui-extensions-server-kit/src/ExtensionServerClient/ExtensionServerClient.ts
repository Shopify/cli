/* eslint-disable no-console */
import {APIClient} from './APIClient'
import {isValidSurface} from '../utilities'
import {DeepPartial} from '../types'

export class ExtensionServerClient implements ExtensionServer.Client {
  public id: string

  public connection!: WebSocket

  public api!: ExtensionServer.API.Client

  public options: ExtensionServer.Options

  protected EVENT_THAT_WILL_MUTATE_THE_SERVER = ['update']

  protected listeners: {[key: string]: Set<any>} = {}

  protected connected = false

  constructor(options: DeepPartial<ExtensionServer.Options> = {}) {
    this.id = (Math.random() + 1).toString(36).substring(7)
    this.options = getValidatedOptions({
      ...options,
      connection: {
        automaticConnect: true,
        protocols: [],
        ...(options.connection ?? {}),
      },
    }) as ExtensionServer.Options

    this.setupConnection(this.options.connection.automaticConnect)
  }

  public connect(options: ExtensionServer.Options = {connection: {}}) {
    const newOptions = mergeOptions(this.options, options)
    const optionsChanged = JSON.stringify(newOptions) !== JSON.stringify(this.options)

    if (optionsChanged) {
      this.options = newOptions
      this.setupConnection(true)
    }

    return () => {
      this.closeConnection()
    }
  }

  public on<TEvent extends keyof ExtensionServer.InboundEvents>(
    event: TEvent,
    listener: (payload: ExtensionServer.InboundEvents[TEvent]) => void,
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set()
    }

    this.listeners[event].add(listener)
    return () => this.listeners[event].delete(listener)
  }

  public persist<TEvent extends keyof ExtensionServer.OutboundPersistEvents>(
    event: TEvent,
    data: ExtensionServer.OutboundPersistEvents[TEvent],
  ): void {
    if (this.EVENT_THAT_WILL_MUTATE_THE_SERVER.includes(event)) {
      return this.connection?.send(JSON.stringify({event, data}))
    }

    console.warn(`You tried to use "persist" with a dispatch event. Please use the "emit" method instead.`)
  }

  public emit<TEvent extends keyof ExtensionServer.DispatchEvents>(...args: ExtensionServer.EmitArgs<TEvent>): void {
    const [event, data] = args

    if (this.EVENT_THAT_WILL_MUTATE_THE_SERVER.includes(event)) {
      return console.warn(
        `You tried to use "emit" with a the "${event}" event. Please use the "persist" method instead to persist changes to the server.`,
      )
    }

    this.connection?.send(JSON.stringify({event: 'dispatch', data: {type: event, payload: data}}))
  }

  protected initializeApiClient() {
    let url = ''
    if (this.options.connection.url) {
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      const socketUrl = new URL(this.options.connection.url)
      socketUrl.protocol = socketUrl.protocol === 'ws:' ? 'http:' : 'https:'
      url = socketUrl.origin
    }
    this.api = new APIClient(url, this.options.surface)
  }

  protected initializeConnection() {
    if (!this.connection) {
      return
    }

    this.connection.onopen = () => {
      this.connected = true
    }

    this.connection.onclose = () => {
      this.connected = false
    }

    this.connection?.addEventListener('message', (message) => {
      try {
        const {event, data} = JSON.parse(message.data) as ExtensionServer.ServerEvents

        if (event === 'dispatch') {
          const {type, payload} = data
          this.listeners[type]?.forEach((listener) => listener(payload))
          return
        }

        const filteredExtensions = data.extensions?.filter(
          (extension: any) => !this.options.surface || extension.surface === this.options.surface,
        )
        this.listeners[event]?.forEach((listener) => {
          listener({...data, extensions: filteredExtensions})
        })
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err) {
        console.error(
          `[ExtensionServer] Something went wrong while parsing a server message:`,
          err instanceof Error ? err.message : err,
        )
      }
    })
  }

  protected setupConnection(connectWebsocket = true) {
    if (!this.options.connection.url) {
      return
    }

    if (!this.api || this.api.url !== this.connection.url) {
      this.initializeApiClient()
    }

    if (!connectWebsocket) {
      return
    }

    this.closeConnection()

    this.connection = new WebSocket(this.options.connection.url, this.options.connection.protocols)

    this.initializeConnection()
  }

  protected closeConnection() {
    if (this.connected) {
      this.connection?.close()
    }
  }
}

function mergeOptions(options: ExtensionServer.Options, newOptions: ExtensionServer.Options) {
  return getValidatedOptions({
    ...options,
    ...newOptions,
    connection: {
      ...options.connection,
      ...newOptions.connection,
    },
  })
}

function getValidatedOptions<TOptions extends DeepPartial<ExtensionServer.Options>>(options: TOptions): TOptions {
  if (!isValidSurface(options.surface)) {
    delete options.surface
  }
  return options
}
