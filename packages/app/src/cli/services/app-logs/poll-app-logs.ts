import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000
const ONE_MILLION = 1000000

const generateFetchAppLogUrl = async (
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
) => {
  const fqdn = await partnersFqdn()
  let url = `https://${fqdn}/app_logs/poll`

  if (!cursor) {
    return url
  }

  url += `?cursor=${cursor}`

  if (filters?.status) {
    url += `&status=${filters.status}`
  }
  if (filters?.source) {
    url += `&source=${filters.source}`
  }

  return url
}

export const appLogsDevOutput = ({stdout, log}: {stdout: Writable; log: AppEventData; apiKey?: string}) => {
  const payload = JSON.parse(log.payload)
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
}

export const appLogsLogsOutput = ({stdout, log}: {stdout: Writable; log: AppEventData; apiKey?: string}) => {
  const payload = JSON.parse(log.payload)
  const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)
  const status = log.status
  const parsedPayload = JSON.parse(log.payload)
  const {logs, input, input_bytes: inputBytes, function_id: functionId} = parsedPayload

  const needed = {
    source: log.source,
    status,
    functionId,
    fuelConsumed: fuel,
    logs,
    input,
    inputBytes,
  }

  if (logs.length > 0) {
    stdout.write(JSON.stringify(needed))
  }
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
  appLogsFetchInput: {jwtToken, cursor, filters},
  apiKey,
  resubscribeCallback,
  outputCallback,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string; filters?: {status?: string; source?: string}}
  apiKey: string
  resubscribeCallback: () => Promise<void>
  outputCallback: ({stdout, log}: {stdout: Writable; log: AppEventData; apiKey?: string}) => void
}) => {
  try {
    const url = await generateFetchAppLogUrl(cursor, filters)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    })

    if (!response.ok) {
      const responseText = await response.text()
      if (response.status === 401) {
        await resubscribeCallback()
      } else if (response.status === 429 || response.status >= 500) {
        stdout.write(`Received an error while polling for app logs.`)
        stdout.write(`${response.status}: ${response.statusText}`)
        stdout.write(responseText)
        stdout.write(`Retrying in ${POLLING_BACKOFF_INTERVAL_MS / 1000} seconds`)
        setTimeout(() => {
          pollAppLogs({
            stdout,
            appLogsFetchInput: {
              jwtToken,
              cursor: undefined,
              filters,
            },
            apiKey,
            resubscribeCallback,
            outputCallback,
          }).catch((error) => {
            outputDebug(`Unexpected error during polling: ${error}}\n`)
          })
        }, POLLING_BACKOFF_INTERVAL_MS)
      } else {
        throw new Error(`Error while fetching: ${responseText}`)
      }
      return
    }

    const data = (await response.json()) as {
      app_logs?: AppEventData[]
      cursor?: string
      errors?: string[]
    }
    if (data.app_logs) {
      const {app_logs: appLogs} = data

      for (const log of appLogs) {
        // eslint-disable-next-line no-await-in-loop
        await useConcurrentOutputContext({outputPrefix: log.source}, async () => {
          outputCallback({stdout, log, apiKey})
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
          filters,
        },
        apiKey,
        resubscribeCallback,
        outputCallback,
      }).catch((error) => {
        outputDebug(`Unexpected error during polling: ${error}}\n`)
      })
    }, POLLING_INTERVAL_MS)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    stdout.write(`Error while retrieving app logs.`)
    stdout.write('App log streaming is no longer available in this `dev` session.')
    outputDebug(`${error}}\n`)
  }
}
