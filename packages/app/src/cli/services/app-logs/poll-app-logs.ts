import {writeAppLogsToFile} from './write-app-logs.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

const POLLING_INTERVAL_MS = 450
const ONE_MILLION = 1000000

const generateFetchAppLogUrl = async (cursor?: string) => {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/app_logs/poll`
  return url + (cursor ? `?cursor=${cursor}` : '')
}

export interface AppEventData {
  shop_id: number
  api_client_id: number
  payload: string
  event_type: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export const pollAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor},
  apiKey,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string}
  apiKey: string
}) => {
  const url = await generateFetchAppLogUrl(cursor)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (!response.ok) {
    // We should add some exponential backoff here to not spam partners

    const responseText = await response.text()
    throw new Error(`Error while fetching: ${responseText}`)
  }

  const data = (await response.json()) as {
    app_logs?: AppEventData[]
    cursor?: string
    errors?: string[]
  }

  if (data.app_logs) {
    const {app_logs: appLogs} = data

    const functionLogs = appLogs.filter((appLog) => appLog.event_type === 'function_run')

    for (const functionLog of functionLogs) {
      const payload = JSON.parse(functionLog.payload)
      const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)

      if (functionLog.status === 'success') {
        stdout.write(`Function executed succesfully using ${fuel}M instructions.`)
      } else if (functionLog.status === 'failure') {
        stdout.write(`❌ Function failed to execute with error: ${payload.error_type}`)
      }

      // print the logs from the appLogs as well
      const logs = JSON.parse(functionLog.payload).logs
      stdout.write(logs)

      // eslint-disable-next-line no-await-in-loop
      await writeAppLogsToFile({
        appLog: functionLog,
        apiKey,
        stdout,
      })
    }
  }

  const cursorFromResponse = data?.cursor

  setTimeout(() => {
    pollAppLogs({
      stdout,
      appLogsFetchInput: {
        jwtToken,
        cursor: cursorFromResponse,
      },
      apiKey,
    }).catch((error) => {
      throw new Error(`${error} error while fetching.`)
    })
  }, POLLING_INTERVAL_MS)
}
