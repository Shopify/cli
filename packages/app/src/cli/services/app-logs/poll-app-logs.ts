import {writeAppLogsToFile} from './write-app-logs.js'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
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
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export const pollAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor},
  apiKey,
  resubscribeCallback,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string}
  apiKey: string
  resubscribeCallback: () => Promise<void>
}) => {
  const url = await generateFetchAppLogUrl(cursor)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (response.status === 401) {
    await resubscribeCallback()
    return
  }

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

    for (const log of appLogs) {
      const payload = JSON.parse(log.payload)

      // eslint-disable-next-line no-await-in-loop
      await useConcurrentOutputContext({outputPrefix: log.source}, async () => {
        if (log.event_type === 'function_run') {
          const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)

          if (log.status === 'success') {
            stdout.write(`Function executed successfully using ${fuel}M instructions.`)
          } else if (log.status === 'failure') {
            stdout.write(`❌ Function failed to execute with error: ${payload.error_type}`)
          }

          const logs = payload.logs
          if (logs.length > 0) {
            stdout.write(logs)
          }
        } else {
          stdout.write(JSON.stringify(payload))
        }

        await writeAppLogsToFile({
          appLog: log,
          apiKey,
          stdout,
        })
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
      resubscribeCallback,
    }).catch((error) => {
      throw new Error(`${error} error while fetching.`)
    })
  }, POLLING_INTERVAL_MS)
}
