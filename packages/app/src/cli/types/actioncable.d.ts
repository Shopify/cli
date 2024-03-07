// From DefinitelyTyped: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/actioncable/index.d.ts

declare module 'actioncable' {
  interface Channel {
    unsubscribe(): void
    perform(action: string, data: {}): void
    send(data: unknown): boolean
  }

  interface Subscriptions {
    create<T extends CreateMixin>(channel: string | ChannelNameWithParams, obj?: T & ThisType<Channel>): Channel & T
  }

  interface Cable {
    subscriptions: Subscriptions
    send(data: unknown): void
    connect(): void
    disconnect(): void
    ensureActiveConnection(): void
  }

  interface CreateMixin {
    connected?(): void
    disconnected?(): void
    received?(obj: unknown): void
    [key: string]: unknown
  }

  interface ChannelNameWithParams {
    channel: string
    [key: string]: unknown
  }

  function createConsumer(): Cable
  function createConsumer(url: string): Cable
}

declare interface AppInterface {
  cable?: ActionCable.Cable | undefined
  network?: ActionCable.Channel | undefined
}

declare let App: AppInterface

declare module '@rails/actioncable' {
  export = ActionCable
}
