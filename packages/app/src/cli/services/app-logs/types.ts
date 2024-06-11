import {Response} from 'node-fetch'
import {Writable} from 'stream'

export interface AppEventData {
  shop_id: number
  api_client_id: number
  payload: string
  event_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export type AppLogsPollingCommandOutputFunction = ({
  stdout,
  log,
  apiKey,
}: {
  stdout: Writable
  log: AppEventData
  apiKey?: string
}) => Promise<void> | void

export type AppLogsPollingCommandRetryOutputFunction = ({
  stdout,
  response,
  apiKey,
}: {
  stdout: Writable
  response: Response
  apiKey?: string
}) => Promise<void>

export type AppLogsPollingCommandErrorOutputFunction = ({stdout}: {stdout: Writable}) => void
