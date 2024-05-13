import {functionOutput} from './output.js'
import {writeAppLogsToFile} from './write_app_logs.js'
import {Writable} from 'stream'

const generateFetchAppLogUrl = (cursor?: string) => {
  // TODO: not hardcode this
  const url = 'https://partners.script-service-0s4r.mehdi-salemi.us.spin.dev/app_logs/poll'
  return url + (cursor ? `?cursor=${cursor}` : '')
}

export interface AppLog {
  logs?: string
  error_message?: string
  error_type?: string
  fuel_consumed?: number
  input?: string
  output?: string
  input_bytes?: number
  output_bytes?: number
  invocation_id?: string
  function_id?: string
}

export const fetchAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor},
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string}
}) => {
  stdout.write(`JWT Token Poll: ${jwtToken}\n`)
  stdout.write(`Cursor: ${cursor || 'First time sending request - no cursor'}\n`)

  const url = generateFetchAppLogUrl(cursor)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = (await response.json()) as {
    app_logs?: {
      event_type: string
      shop_id: number
      api_client_id: number
      event_timestamp: string
      payload: string
      status: string
      log_timestamp: string
    }[]
    cursor?: string
    errors?: string[]
  }

  // console.log('data', data)

  // const payload = data?.app_logs?.map((log) => log.payload)
  // const parsedPayload = payload?.map((log) => JSON.parse(log))
  // console.log('parsedPayload', parsedPayload)

  // writeAppLogsToFile({
  //   appLog: {
  //     logs: 'Error occurred while fetching logs',
  //   },
  //   writePath: './runs',
  //   stdout,
  // })

  if (data?.errors) {
    data?.errors?.forEach((error) => {
      stdout.write(`${error}\n`)
    })
  } else if (data.app_logs) {
    const {app_logs: appLogs} = data
    console.log('appLogs', appLogs)
    appLogs?.forEach((log) => {
      writeAppLogsToFile({
        appLog: log.payload,
        writePath: './runs',
        stdout,
        label: log.event_timestamp,
      })
      functionOutput({log: log.payload, stdout})
    })
  }

  const cursorFromResponse = data?.cursor

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    await fetchAppLogs({
      stdout,
      appLogsFetchInput: {
        jwtToken,
        cursor: cursorFromResponse,
      },
    })
  }, 1000)
}
