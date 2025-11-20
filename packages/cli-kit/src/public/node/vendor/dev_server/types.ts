export interface DevServerCore {
  url(prefix: string): string
  host(prefix: string): string
}

export interface DevServer {
  url(options?: HostOptions): string
  host(options?: HostOptions): string
}

export interface HostOptions {
  nonstandardHostPrefix?: string
  useMockIfNotRunning?: boolean
}
