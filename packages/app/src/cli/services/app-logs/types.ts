import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface SuccessResponse {
  appLogs: AppLogData[]
  cursor?: string
}

export interface ErrorResponse {
  errors: {
    status: number
    message: string
  }[]
}

export type PollResponse = SuccessResponse | ErrorResponse

export interface AppLogData {
  shop_id: number
  api_client_id: number
  payload: string
  log_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export class FunctionRunLog {
  export: string
  input: unknown
  inputBytes: number
  output: unknown
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  errorMessage: string | null
  errorType: string | null

  constructor({
    export: exportValue,
    input,
    inputBytes,
    output,
    outputBytes,
    logs,
    functionId,
    fuelConsumed,
    errorMessage,
    errorType,
  }: {
    export: string
    input: unknown
    inputBytes: number
    output: unknown
    outputBytes: number
    logs: string
    functionId: string
    fuelConsumed: number
    errorMessage: string | null
    errorType: string | null
  }) {
    this.export = exportValue
    this.input = input
    this.inputBytes = inputBytes
    this.output = output
    this.outputBytes = outputBytes
    this.logs = logs
    this.functionId = functionId
    this.fuelConsumed = fuelConsumed
    this.errorMessage = errorMessage
    this.errorType = errorType
  }
}

export class NetworkAccessResponseFromCacheLog {
  cacheEntryEpochMs: number
  cacheTtlMs: number
  httpRequest: unknown
  httpResponse: unknown

  constructor({
    cacheEntryEpochMs,
    cacheTtlMs,
    httpRequest,
    httpResponse,
  }: {
    cacheEntryEpochMs: number
    cacheTtlMs: number
    httpRequest: unknown
    httpResponse: unknown
  }) {
    this.cacheEntryEpochMs = cacheEntryEpochMs
    this.cacheTtlMs = cacheTtlMs
    this.httpRequest = httpRequest
    this.httpResponse = httpResponse
  }
}

export enum BackgroundExecutionReason {
  NoCachedResponse,
  CacheAboutToExpire,
  Unknown,
}

export class NetworkAccessRequestExecutionInBackgroundLog {
  reason: BackgroundExecutionReason
  httpRequest: unknown

  constructor({reason, httpRequest}: {reason: BackgroundExecutionReason; httpRequest: unknown}) {
    this.reason = reason
    this.httpRequest = httpRequest
  }
}

export class NetworkAccessRequestExecutedLog {
  attempt: number
  connectTimeMs: number | null
  writeReadTimeMs: number | null
  httpRequest: unknown
  httpResponse: unknown
  error: string | null

  constructor({
    attempt,
    connectTimeMs,
    writeReadTimeMs,
    httpRequest,
    httpResponse,
    error,
  }: {
    attempt: number
    connectTimeMs: number | null
    writeReadTimeMs: number | null
    httpRequest: unknown
    httpResponse: unknown
    error: string | null
  }) {
    this.attempt = attempt
    this.connectTimeMs = connectTimeMs
    this.writeReadTimeMs = writeReadTimeMs
    this.httpRequest = httpRequest
    this.httpResponse = httpResponse
    this.error = error
  }
}

export type AppLogPayload =
  | FunctionRunLog
  | NetworkAccessResponseFromCacheLog
  | NetworkAccessRequestExecutionInBackgroundLog
  | NetworkAccessRequestExecutedLog

export interface SubscribeOptions {
  developerPlatformClient: DeveloperPlatformClient
  variables: {
    shopIds: string[]
    apiKey: string
    token: string
  }
}

export interface PollOptions {
  jwtToken: string
  cursor?: string
  filters: PollFilters
}

export interface PollFilters {
  status: string | undefined
  sources: string[] | undefined
}
export interface AppLogPrefix {
  status: string
  source: string
  storeName: string
  description: string
  logTimestamp: string
}

export interface AppLogOutput {
  prefix: AppLogPrefix
  appLog: AppLogPayload
}
