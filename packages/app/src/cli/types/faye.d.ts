declare module 'faye' {
  let logger: (msg: string) => void
  export class Client {
    constructor(url: string)
    subscribe(channel: string, callback: (message: unknown) => void): Promise<unknown>
    publish(channel: string, message: unknown, options: unknown): Promise<unknown>
  }
}
