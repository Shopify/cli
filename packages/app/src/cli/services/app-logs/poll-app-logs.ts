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

    const functionLogs = appLogs.filter((appLog) => appLog.event_type === 'function_run' || appLog.event_type.startsWith("function_network_access"))

    for (const functionLog of functionLogs) {
      const payload = JSON.parse(functionLog.payload)

      // eslint-disable-next-line no-await-in-loop
      await useConcurrentOutputContext({outputPrefix: functionLog.source}, async () => {
        if (functionLog.event_type === 'function_run') {
          const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)
          if (functionLog.status === 'success') {
            stdout.write(`Function target (${payload.export}) executed successfully using ${fuel}M instructions.`)
          } else if (functionLog.status === 'failure') {
            stdout.write(`❌ Function target (${payload.export}) failed to execute with error: ${payload.error_type}`)
          }
          // print the logs from the appLogs as well
          const logs = JSON.parse(functionLog.payload).logs
          if (logs.length > 0) {
            stdout.write(logs)
          }
        } else if (functionLog.event_type.startsWith("function_network_access")) {
          if (functionLog.event_type === 'function_network_access.request_execution') {
            if (functionLog.status === 'success') {
              stdout.write(`Function network access executed successfully.\n`);
            } else if (functionLog.status === 'failure') {
              stdout.write(`❌ Function network access failed to execute with error: ${payload.error}\n`);
            }
          } else if (functionLog.event_type === 'function_network_access.cache_read'){
            if (functionLog.status === 'success') {
              stdout.write(`Function network access cache read (hit).\n`);
            } else if (functionLog.status === 'failure') {
              stdout.write(`Function network access cache read (miss).\n`);
            }
          } else if (functionLog.event_type === 'function_network_access.cache_write'){
            stdout.write(`Function network access cache write.\n`);
          }
        }

        await writeAppLogsToFile({
          appLog: functionLog,
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
