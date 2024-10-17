import {writeAppLogsToFile} from './write-app-logs.js'
import {
  POLLING_INTERVAL_MS,
  POLLING_ERROR_RETRY_INTERVAL_MS,
  ONE_MILLION,
  LOG_TYPE_FUNCTION_RUN,
  fetchAppLogs,
  LOG_TYPE_FUNCTION_NETWORK_ACCESS,
  LOG_TYPE_RESPONSE_FROM_CACHE,
  LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
  LOG_TYPE_REQUEST_EXECUTION,
  REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHED_RESPONSE_REASON,
  REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_REASON,
  handleFetchAppLogsError,
} from '../utils.js'
import {AppLogData, ErrorResponse, FunctionRunLog} from '../types.js'
import {outputContent, outputDebug, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import camelcaseKeys from 'camelcase-keys'
import {Writable} from 'stream'

export const pollAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor},
  apiKey,
  resubscribeCallback,
  storeName,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string}
  apiKey: string
  resubscribeCallback: () => Promise<string>
  storeName: string
}) => {
  try {
    let nextJwtToken = jwtToken
    let retryIntervalMs = POLLING_INTERVAL_MS

    const httpResponse = await fetchAppLogs(jwtToken, cursor)

    const response = await httpResponse.json()
    const {errors} = response as {errors: string[]}

    if (errors) {
      const errorResponse = {
        errors: errors.map((error) => ({message: error, status: httpResponse.status})),
      } as ErrorResponse

      const result = await handleFetchAppLogsError({
        response: errorResponse,
        onThrottle: (retryIntervalMs) => {
          outputWarn(`Request throttled while polling app logs.`)
          outputWarn(`Retrying in ${retryIntervalMs / 1000} seconds.`)
        },
        onUnknownError: (retryIntervalMs) => {
          outputWarn(`Error while polling app logs.`)
          outputWarn(`Retrying in ${retryIntervalMs / 1000} seconds.`)
        },
        onResubscribe: () => {
          return resubscribeCallback()
        },
      })

      if (result.nextJwtToken) {
        nextJwtToken = result.nextJwtToken
      }
      retryIntervalMs = result.retryIntervalMs
    }

    const data = response as {
      app_logs?: AppLogData[]
      cursor?: string
      errors?: string[]
    }

    if (data.app_logs) {
      const {app_logs: appLogs} = data

      for (const log of appLogs) {
        let payload = JSON.parse(log.payload)
        // eslint-disable-next-line no-await-in-loop
        await useConcurrentOutputContext({outputPrefix: log.source, stripAnsi: false}, async () => {
          if (log.log_type === LOG_TYPE_FUNCTION_RUN) {
            handleFunctionRunLog(log, payload, stdout)
            payload = new FunctionRunLog(camelcaseKeys(payload, {deep: true}))
          } else if (log.log_type.startsWith(LOG_TYPE_FUNCTION_NETWORK_ACCESS)) {
            handleFunctionNetworkAccessLog(log, payload, stdout)
          } else {
            stdout.write(JSON.stringify(payload))
          }

          const logFile = await writeAppLogsToFile({
            appLog: log,
            appLogPayload: payload,
            apiKey,
            stdout,
            storeName,
          })
          stdout.write(
            outputContent`${outputToken.gray('└ ')}${outputToken.link(
              'Open log file',
              `file://${logFile.fullOutputPath}`,
              `Log: ${logFile.fullOutputPath}`,
            )} ${outputToken.gray(`(${logFile.identifier})`)}\n`.value,
          )
        })
      }
    }

    const cursorFromResponse = data?.cursor

    setTimeout(() => {
      pollAppLogs({
        stdout,
        appLogsFetchInput: {
          jwtToken: nextJwtToken,
          cursor: cursorFromResponse || cursor,
        },
        apiKey,
        resubscribeCallback,
        storeName,
      }).catch((error) => {
        outputDebug(`Unexpected error during polling: ${error}}\n`)
      })
    }, retryIntervalMs)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputWarn(`Error while polling app logs.`)
    outputWarn(`Retrying in ${POLLING_ERROR_RETRY_INTERVAL_MS / 1000} seconds.`)
    outputDebug(`${error as string}}\n`)

    setTimeout(() => {
      pollAppLogs({
        stdout,
        appLogsFetchInput: {
          jwtToken,
          cursor: undefined,
        },
        apiKey,
        resubscribeCallback,
        storeName,
      }).catch((error) => {
        outputDebug(`Unexpected error during polling: ${error}}\n`)
      })
    }, POLLING_ERROR_RETRY_INTERVAL_MS)
  }
}

function handleFunctionRunLog(log: AppLogData, payload: {[key: string]: unknown}, stdout: Writable) {
  const fuel = ((payload.fuel_consumed as number) / ONE_MILLION).toFixed(4)
  if (log.status === 'success') {
    stdout.write(`Function export "${payload.export as string}" executed successfully using ${fuel}M instructions.`)
  } else if (log.status === 'failure') {
    stdout.write(
      `❌ Function export "${payload.export as string}" failed to execute with error: ${payload.error_type as string}`,
    )
  }
  const logs = payload.logs as string
  if (logs.length > 0) {
    stdout.write(
      logs
        .split('\n')
        .filter(Boolean)
        .map((line: string) => outputContent`${outputToken.gray('│ ')}${line}`.value)
        .join('\n'),
    )
  }
}

function handleFunctionNetworkAccessLog(log: AppLogData, payload: {[key: string]: unknown}, stdout: Writable) {
  if (log.log_type === LOG_TYPE_RESPONSE_FROM_CACHE) {
    stdout.write('Function network access response retrieved from cache.')
  } else if (log.log_type === LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND) {
    if (payload.reason === REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHED_RESPONSE_REASON) {
      stdout.write('Function network access request executing in background because there is no cached response.')
    } else if (payload.reason === REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_REASON) {
      stdout.write(
        'Function network access request executing in background because the cached response is about to expire.',
      )
    }
  } else if (log.log_type === LOG_TYPE_REQUEST_EXECUTION) {
    if (log.status === 'success') {
      stdout.write('Function network access request executed successfully.')
    } else if (log.status === 'failure') {
      stdout.write(`❌ Function network access request failed to execute with error: ${payload.error as string}.`)
    }
  }
}
