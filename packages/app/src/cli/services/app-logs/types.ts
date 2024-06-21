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

export interface FunctionRunLog {
  input: unknown
  inputBytes: number
  output: unknown
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  errorMessage: string | null
  errorType: string | null
}

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
  source: string | undefined
}
export interface AppLogPrefix {
  status: string
  source: string
  description: string
  logTimestamp: string
}

export interface AppLogOutput {
  prefix: AppLogPrefix
  appLog: FunctionRunLog
}
