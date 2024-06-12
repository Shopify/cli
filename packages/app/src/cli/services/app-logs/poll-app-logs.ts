import {AppEventData, AppLogsOnFunctionRunCallback, AppLogsOnErrorCallback} from './types.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000

const generateFetchAppLogUrl = async (cursor?: string) => {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/app_logs/poll`
  return url + (cursor ? `?cursor=${cursor}` : '')
}

export const pollAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor},
  apiKey,
  resubscribeCallback,
  onFunctionRunCallback,
  onErrorCallback,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string}
  apiKey: string
  resubscribeCallback: () => Promise<void>
  onFunctionRunCallback: AppLogsOnFunctionRunCallback
  onErrorCallback: AppLogsOnErrorCallback
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
        outputWarn(`Received an error while polling for app logs.`)
        outputDebug(`${response.status}: ${response.statusText}`)
        outputDebug(responseText)
        outputWarn(`Retrying in ${POLLING_BACKOFF_INTERVAL_MS / 1000} seconds`)

        setTimeout(() => {
          pollAppLogs({
            stdout,
            appLogsFetchInput: {
              jwtToken,
              cursor: undefined,
            },
            apiKey,
            resubscribeCallback,
            onFunctionRunCallback,
            onErrorCallback,
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
        await onFunctionRunCallback({stdout, log, apiKey})
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
        onFunctionRunCallback,
        onErrorCallback,
      }).catch((error) => {
        outputDebug(`Unexpected error during polling: ${error}}\n`)
      })
    }, POLLING_INTERVAL_MS)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    onErrorCallback({stdout})
    outputDebug(`${error}}\n`)
  }
}
