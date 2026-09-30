export interface ResponseFixture {
  status?: number
  headers?: Record<string, string>
  body?: unknown
  text?: string
  delayMs?: number
  disconnect?: boolean
}

export interface RequestFixture {
  method: string
  url: string
  operation?: string
  variables?: Record<string, unknown>
  form?: Record<string, string>
  headers?: Record<string, string>
  responses: ResponseFixture[]
  repeatLastResponse?: boolean
  passthrough?: boolean
}

export interface SubprocessFixture {
  command: string
  args?: string[]
  stdout?: string
  stderr?: string
  exitCode?: number
  maxCalls?: number
}

export interface CommandState {
  now: number
  requests: RequestFixture[]
  requestLimit: number
  clock: 'frozen' | 'advancing'
  subprocesses: SubprocessFixture[]
  loopbackPorts: number[]
}

export interface CommandEvent {
  type: 'request' | 'violation' | 'spawn' | 'ready' | 'exit'
  pid?: number
  message?: string
  elapsedMs?: number
  command?: string
  args?: string[]
  method?: string
  url?: string
  operation?: string
  variables?: Record<string, unknown>
  headers?: Record<string, string>
  body?: string
}
