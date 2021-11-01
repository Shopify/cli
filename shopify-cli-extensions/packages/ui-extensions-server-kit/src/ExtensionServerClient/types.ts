/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-namespace */
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
     */
    interface OutboundPersistEvents {
      //
    }

    interface OutboundDispatchEvents {
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
        url: string;

        /**
         * This defines if we should automatically attempt to connect when the
         * class is instantiated.
         *
         * @default true
         */
        automaticConnect?: boolean;

        /**
         * The sub-protocol selected by the server.
         *
         * @default []
         */
        protocols?: string | string[];
      };
    }

    /**
     * Extension server client class. This class will be used to connect and
     * communicate with the extension server.
     */
    interface Client {
      /**
       * Reconnecting WebSocket Client
       */
      connection: WebSocket;

      /**
       * API Client
       */
      api: API.Client;

      /**
       * Function to add an event listener to messages coming from
       * the extension server connection.
       */
      on<Event extends keyof ExtensionServer.InboundEvents>(
        event: Event,
        cb: EventListener<Event>,
      ): EventUnsubscriber;

      /**
       * Function to emit an event that will persist changes to the extension server.
       */
      persist<Event extends keyof OutboundPersistEvents>(
        event: Event,
        payload: OutboundPersistEvents[Event],
      ): void;

      /**
       * Function to emit an event to the extension server.
       */
      emit<Event extends keyof OutboundDispatchEvents>(...args: EmitArgs<Event>): void;

      connect(options?: Options): () => void;
    }

    /**
     * This defines how the ExtensionServer client's static class is defined and the constructor
     * arguments it requires.
     *
     * @example const client = new ExtensionServer({ url: 'wss://localhost:1234' });
     */
    type StaticClient = Static<ExtensionServer.Client, [option?: ExtensionServer.Options]>;

    // API responses
    namespace API {
      interface Client {
        url: string;
        extensions(): Promise<ExtensionsResponse>;
        extensionById(id: string): Promise<ExtensionResponse>;
      }

      interface BaseResponse {
        app: App;
        version: string;
        root: ResourceURL;
        socket: ResourceURL;
      }

      interface ExtensionsResponse extends BaseResponse {
        extensions: Extension[];
      }

      interface ExtensionResponse extends BaseResponse {
        extension: Extension;
      }

      interface App {
        apiKey: string;
        [key: string]: string;
      }

      interface Extension {
        type: string;
        uuid: string;
        assets: Assets;
        development: Development;
        user: User;
        version: string;
      }

      interface Assets {
        [name: string]: Asset;
      }

      interface Asset {
        name: string;
        url: string;
        rawSearchParams?: string;
      }

      interface Development {
        root: ResourceURL;
        resource: ResourceURL;
        renderer?: Renderer;
        hidden: boolean;
        build_dir?: string;
        root_dir?: string;
        template?: string;
        entries?: {[key: string]: string};
        status: string;
      }

      interface ResourceURL {
        url: string;
      }

      interface Renderer {
        name: string;
        version: string;
      }

      interface User {
        metafields: Metafield[] | null;
      }

      interface Metafield {
        namespace: string;
        key: string;
      }
    }

    // Utilities

    /**
     * This helper type allows us to account for nullish payloads on the emit function.
     * In practice, this will allow TypeScript to type-check the event being emitted
     * and, if the payload isn't required, the second argument won't be necessary.
     */
    type EmitArgs<Event extends keyof ExtensionServer.OutboundDispatchEvents> =
      ExtensionServer.OutboundDispatchEvents[Event] extends void
        ? [event: Event]
        : [event: Event, payload: ExtensionServer.OutboundDispatchEvents[Event]];

    /**
     * This is a helper interface that allows us to define the static methods of a given
     * class. This is useful to define static methods, static properties
     * and constructor variables.
     */
    interface Static<T = unknown, A extends unknown[] = any[]> {
      prototype: T;
      new (...args: A): T;
    }

    /**
     * This helper creates a partial interface with exception to the defined key values.
     */
    type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

    type EventListener<Event extends keyof ExtensionServer.InboundEvents> = (
      payload: ExtensionServer.InboundEvents[Event],
    ) => void;

    type EventUnsubscriber = () => void;
  }
}

export {};
