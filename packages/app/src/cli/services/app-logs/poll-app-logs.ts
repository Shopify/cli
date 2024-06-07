import {writeAppLogsToFile} from './write-app-logs.js'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000
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
  try {
    const url = await generateFetchAppLogUrl(cursor)
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
            },
            apiKey,
            resubscribeCallback,
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

export const pollAppLogs2 = async ({
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

  // console.log('polled')
  if (data.app_logs) {
    const {app_logs: appLogs} = data

    // console.log('hi', appLogs)

    const functionLogs = appLogs.filter((appLog) => appLog.event_type === 'function_run')

    // FOR DISPLAY
    // handle / prefix | status | functionId | fuelConsumed
    // erro logs
    //
    // errro type
    // error message
    // error logs

    // Input (inputSize)
    // input

    for (const functionLog of functionLogs) {
      // console.log('functionLog', functionLog)
      const payload = JSON.parse(functionLog.payload)
      // console.log(payload)
      const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)
      const status = functionLog.status

      // print the logs from the appLogs as well
      const parsedPayload = JSON.parse(functionLog.payload)
      const {logs, input, input_bytes: inputBytes, function_id: functionId} = parsedPayload
      // console.log('this is what wwe need', {
      //   handle: 'product-discounts',
      //   status,
      //   functionId,
      //   fuelConsumed: fuel,
      //   logs,
      //   input,
      //   inputBytes,
      // })

      const needed = {
        handle: 'product-discounts',
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

      // await writeAppLogsToFile({
      //   appLog: functionLog,
      //   apiKey,
      //   stdout,
      // })
    }
  }

  const cursorFromResponse = data?.cursor

  setTimeout(() => {
    pollAppLogs2({
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

export const logsCommandPollAppLogs = async ({
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

  // console.log('polled')
  if (data.app_logs) {
    const {app_logs: appLogs} = data

    // console.log('hi', appLogs)

    const functionLogs = appLogs.filter((appLog) => appLog.event_type === 'function_run')

    for (const functionLog of functionLogs) {
      const payload = JSON.parse(functionLog.payload)
      const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)

      if (functionLog.status === 'success') {
        stdout.write(`Function executed successfully using ${fuel}M instructions.`)
      } else if (functionLog.status === 'failure') {
        stdout.write(`❌ Function failed to execute with error: ${payload.error_type}`)
      }

      // print the logs from the appLogs as well
      const logs = JSON.parse(functionLog.payload).logs
      if (logs.length > 0) {
        stdout.write(logs)
      }

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
    pollAppLogs2({
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
