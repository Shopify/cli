/* eslint-disable @typescript-eslint/naming-convention */
import {fetch} from './http.js'
import {debug, content, token} from './output.js'
import {JsonMap} from './json.js'

const url = 'https://monorail-edge.shopifysvc.com/v1/produce'

type Optional<T> = T | null

export interface Schemas {
  'app_cli3_command/1.0': {
    sensitive: {args: string; error_message?: Optional<string>; metadata?: Optional<string>}
    public: {
      partner_id?: Optional<number>
      command: string
      project_type?: Optional<string>
      time_start: number
      time_end: number
      total_time: number
      success: boolean
      api_key?: Optional<string>
      cli_version: string
      uname: string
      ruby_version: string
      node_version: string
      is_employee: boolean
    }
  }
  [schemaId: string]: {sensitive: JsonMap; public: JsonMap}
}

type MonorailResult = {type: 'ok'} | {type: 'error'; message: string}

export async function publishEvent<TSchemaId extends keyof Schemas, TPayload extends Schemas[TSchemaId]>(
  schemaId: TSchemaId,
  publicData: TPayload['public'],
  sensitiveData: TPayload['sensitive'],
): Promise<MonorailResult> {
  try {
    const currentTime = new Date().getTime()
    const payload = {...publicData, ...sensitiveData}
    const body = JSON.stringify({schema_id: schemaId, payload})
    const headers = buildHeaders(currentTime)

    const response = await fetch(url, {method: 'POST', body, headers})

    if (response.status === 200) {
      debug(content`Analytics event sent: ${token.json(payload)}`)
      return {type: 'ok'}
    } else {
      debug(`Failed to report usage analytics: ${response.statusText}`)
      return {type: 'error', message: response.statusText}
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
    return {type: 'error', message}
  }
}

const buildHeaders = (currentTime: number) => {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': currentTime.toString(),
    'X-Monorail-Edge-Event-Sent-At-Ms': currentTime.toString(),
  }
}
