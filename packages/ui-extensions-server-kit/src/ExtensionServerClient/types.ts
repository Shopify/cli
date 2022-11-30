import {ExtensionPoints, Status} from 'types'

declare global {
  namespace ExtensionServer {
    /**
     * Events being received by the extension server where the keys are the event names
     * and the values are the payload of the given action. In case no payload is
     * required, a value of void should be used.
     */
    interface InboundEvents {
      //
    }

    /**
     * Events being sent to the extension server where the keys are the event names
     * and the values are the payload of the given action. In case no payload is
     * required, a value of void should be used.
     *
     * Persist events are those that will generate changes on the server, like
     * update and connected events. Dispatch events are those that will
     * simply be proxied to the clients connected to the server.
     */
    interface OutboundPersistEvents {
      //
    }

    interface DispatchEvents {
      //
    }

    /**
     * Extension server client class options. These are used to configure
     * the client class.
     */
    interface Options {
      connection: {
        /**
         * The absolute URL of the WebSocket.
         */
        url?: string

        /**
         * This defines if we should automatically attempt to connect when the
         * class is instantiated.
         *
         * @defaultValue true
         */
        automaticConnect?: boolean

        /**
         * The sub-protocol selected by the server.
         *
         * @defaultValue []
         */
        protocols?: string | string[]
      }
      /**
       * If provided the extension server will only return extensions that matches the specified surface
       */
      surface?: Surface
    }

    /**
     * Extension server client class. This class will be used to connect and
     * communicate with the extension server.
     */
    interface Client {
      /**
       * Connection options
       */
      options: Options

      /**
       * Reconnecting WebSocket Client
       */
      connection: WebSocket

      /**
       * Function to add an event listener to messages coming from
       * the extension server connection.
       */
      on<TEvent extends keyof ExtensionServer.InboundEvents>(
        event: TEvent,
        cb: EventListener<TEvent>,
      ): EventUnsubscriber

      /**
       * Function to emit an event that will persist changes to the extension server.
       */
      persist<TEvent extends keyof OutboundPersistEvents>(event: TEvent, payload: OutboundPersistEvents[TEvent]): void

      /**
       * Function to emit an event to the extension server.
       */
      emit<TEvent extends keyof DispatchEvents>(...args: EmitArgs<TEvent>): void

      /**
       * Function that opens a connection with the extensions server.
       */
      connect(options?: Options): () => void
    }

    /**
     * This defines how the ExtensionServer client's static class is defined and the constructor
     * arguments it requires.
     *
     * @example
     * ```
     * const client = new ExtensionServer({ url: 'wss://localhost:1234' });
     * ```
     */
    type StaticClient = Static<ExtensionServer.Client, [option?: ExtensionServer.Options]>

    // API responses
    namespace API {
      interface Client {
        url: string
        extensions(): Promise<ExtensionsResponse>
        extensionById(id: string): Promise<ExtensionResponse>
      }

      interface BaseResponse {
        app: App
        root: ResourceURL
        socket: ResourceURL
        devConsole: ResourceURL
        store: string
        version: string
      }

      interface ExtensionsResponse extends BaseResponse {
        extensions: Extension[]
      }

      interface ExtensionResponse extends BaseResponse {
        extension: Extension
      }

      interface App {
        apiKey: string
        [key: string]: string
      }

      interface Extension {
        assets: Assets
        development: Development
        extensionPoints: ExtensionPoints
        surface: Surface
        name?: string
        title?: string
        type: string
        metafields: Metafield[] | null
        uuid: string
        version: string
      }

      interface Assets {
        [name: string]: Asset
      }

      interface Asset {
        name: string
        url: string
        lastUpdated: number
        rawSearchParams?: string
      }

      interface Development {
        root: ResourceURL
        resource: ResourceURL
        renderer: Renderer
        hidden: boolean
        buildDir?: string
        rootDir?: string
        template?: string
        entries?: {[key: string]: string}
        status: Status
      }

      interface ResourceURL {
        url: string
      }

      interface Renderer {
        name: string
        version: string
      }

      interface Metafield {
        namespace: string
        key: string
      }
    }

    // Utilities

    /**
     * This helper type allows us to account for nullish payloads on the emit function.
     * In practice, this will allow TypeScript to type-check the event being emitted
     * and, if the payload isn't required, the second argument won't be necessary.
     */
    type EmitArgs<TEvent extends keyof ExtensionServer.DispatchEvents> =
      ExtensionServer.DispatchEvents[TEvent] extends void
        ? [event: TEvent]
        : [event: TEvent, payload: ExtensionServer.DispatchEvents[TEvent]]

    /**
     * This is a helper interface that allows us to define the static methods of a given
     * class. This is useful to define static methods, static properties
     * and constructor variables.
     */
    interface Static<T = unknown, TArgs extends unknown[] = unknown[]> {
      prototype: T
      new (...args: TArgs): T
    }

    /**
     * This helper creates a partial interface with exception to the defined key values.
     */
    type PartialExcept<TOject, TKey extends keyof TOject> = Partial<Omit<TOject, TKey>> & Pick<TOject, TKey>

    type EventListener<TEvent extends keyof ExtensionServer.InboundEvents> = (
      payload: ExtensionServer.InboundEvents[TEvent],
    ) => void

    type EventUnsubscriber = () => void
  }
}

export const AVAILABLE_SURFACES = ['admin', 'checkout', 'post-checkout', 'pos', 'customer-accounts'] as const

export type Surface = typeof AVAILABLE_SURFACES[number]

export {}
