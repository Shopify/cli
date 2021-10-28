import { APIClient } from './APIClient';

export class ExtensionServerClient implements ExtensionServer.Client {
  protected options: ExtensionServer.Options;

  protected EVENT_THAT_WILL_MUTATE_THE_SERVER = ['update'];

  protected listeners: Record<string, Set<any>> = {};

  public id = (Math.random() + 1).toString(36).substring(7);

  connection!: WebSocket;

  api!: ExtensionServer.API.Client;

  constructor(options: ExtensionServer.Options) {
    this.options = {
      ...options,
      connection: {
        automaticConnect: true,
        protocols: [],
        ...options.connection,
      },
    };

    if (this.options.connection.automaticConnect) {
      this.connect();
    }

    this.initializeApiClient();
  }

  protected initializeApiClient() {
    let url = '';
    if (this.options.connection.url) {
      const socketUrl = new URL(this.options.connection.url);
      socketUrl.protocol = socketUrl.protocol === 'ws:' ? 'http:' : 'https:';
      url = socketUrl.origin;
    }
    this.api = new APIClient(url);
  }

  protected initializeConnection() {
    this.connection.addEventListener('message', (message) => {
      try {
        const {event, data} = JSON.parse(message.data) as {
          event: string;
          data: ExtensionServer.InboundEvents[keyof ExtensionServer.InboundEvents];
        };
        if (event === 'dispatch') {
          const {type, payload} = data as {
            type: keyof ExtensionServer.InboundEvents;
            payload: ExtensionServer.InboundEvents[keyof ExtensionServer.InboundEvents];
          };
          return (this.listeners[type] ?? []).forEach((listener) => listener(payload));
        }

        this.listeners[event].forEach((listener) => listener(data));
      } catch (e) {
        console.error(
          `[ExtensionServer] Something went wrong while parsing a server message:`,
          e instanceof Error ? e.message : e,
        );
      }
    });
  }

  protected mergeOptions(options: ExtensionServer.Options) {
    this.options = {
      ...this.options,
      ...options,
      connection: {
        ...this.options.connection,
        ...options.connection,
      },
    };
  }

  public connect(options?: ExtensionServer.Options) {
    if (!this.connection || this.connection?.readyState === this.connection?.CLOSED) {
      if (options) {
        this.mergeOptions(options);
      }

      this.connection = new WebSocket(
        this.options.connection.url,
        this.options.connection.protocols,
      );

      if (!this.api || this.api.url !== this.connection.url) {
        this.initializeApiClient();
      }

      this.initializeConnection();
    }

    return () => this.connection.close();
  }

  public on<Event extends keyof ExtensionServer.InboundEvents>(
    event: Event,
    listener: (payload: ExtensionServer.InboundEvents[Event]) => void,
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }

    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  public persist<Event extends keyof ExtensionServer.OutboundPersistEvents>(
    event: Event,
    data: ExtensionServer.OutboundPersistEvents[Event],
  ): void {
    if (this.EVENT_THAT_WILL_MUTATE_THE_SERVER.includes(event)) {
      return this.connection.send(JSON.stringify({event, data}));
    }

    console.warn(
      `You tried to use "persist" with a dispatch event. Please use the "emit" method instead.`,
    );
  }

  public emit<Event extends keyof ExtensionServer.OutboundDispatchEvents>(
    ...args: ExtensionServer.EmitArgs<Event>
  ): void {
    const [event, data] = args;

    if (this.EVENT_THAT_WILL_MUTATE_THE_SERVER.includes(event)) {
      return console.warn(
        `You tried to use "emit" with a the "${event}" event. Please use the "persist" method instead to persist changes to the server.`,
      );
    }

    this.connection.send(JSON.stringify({event: 'dispatch', data: {type: event, payload: data}}));
  }
}
