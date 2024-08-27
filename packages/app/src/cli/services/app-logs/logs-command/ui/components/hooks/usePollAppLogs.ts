import {
  ONE_MILLION,
  POLLING_INTERVAL_MS,
  parseFunctionRunPayload,
  LOG_TYPE_FUNCTION_RUN,
  LOG_TYPE_RESPONSE_FROM_CACHE,
  parseNetworkAccessResponseFromCachePayload,
  LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
  parseNetworkAccessRequestExecutionInBackgroundPayload,
  LOG_TYPE_REQUEST_EXECUTION,
  parseNetworkAccessRequestExecutedPayload,
  handleFetchAppLogsError,
} from '../../../../utils.js'
import {ErrorResponse, SuccessResponse, AppLogOutput, PollFilters, AppLogPayload} from '../../../../types.js'
import {pollAppLogs} from '../../../poll-app-logs.js'
import {useState, useEffect} from 'react'
import {formatLocalDate} from '@shopify/cli-kit/common/string'

interface UsePollAppLogsOptions {
  initialJwt: string
  filters: PollFilters
  resubscribeCallback: () => Promise<string>
  storeNameById: Map<string, string>
}

export function usePollAppLogs({initialJwt, filters, resubscribeCallback, storeNameById}: UsePollAppLogsOptions) {
  const [errors, setErrors] = useState<string[]>([])
  const [appLogOutputs, setAppLogOutputs] = useState<AppLogOutput[]>([])

  useEffect(() => {
    const poll = async ({jwtToken, cursor, filters}: {jwtToken: string; cursor?: string; filters: PollFilters}) => {
      let nextJwtToken = jwtToken
      let retryIntervalMs = POLLING_INTERVAL_MS
      const response = await pollAppLogs({jwtToken, cursor, filters})

      const errorResponse = response as ErrorResponse

      if (errorResponse.errors) {
        const result = await handleFetchAppLogsError({
          response: errorResponse,
          onThrottle: (retryIntervalMs) => {
            setErrors(['Request throttled while polling app logs.', `Retrying in ${retryIntervalMs / 1000}s`])
          },
          onUnknownError: (retryIntervalMs) => {
            setErrors(['Error while polling app logs', `Retrying in ${retryIntervalMs / 1000}s`])
          },
          onResubscribe: () => {
            return resubscribeCallback()
          },
        })

        if (result.nextJwtToken) {
          nextJwtToken = result.nextJwtToken
        }
        retryIntervalMs = result.retryIntervalMs
      } else {
        setErrors((errors) => (errors.length ? [] : errors))
      }

      const {cursor: nextCursor, appLogs} = response as SuccessResponse

      if (appLogs) {
        for (const log of appLogs) {
          let appLog: AppLogPayload
          let description
          let executionTime

          const storeName = storeNameById.get(log.shop_id.toString())
          if (storeName === undefined) {
            continue
          }

          switch (log.log_type) {
            case LOG_TYPE_FUNCTION_RUN:
              appLog = parseFunctionRunPayload(log.payload)
              description = `export "${appLog.export}" executed in ${(appLog.fuelConsumed / ONE_MILLION).toFixed(
                4,
              )}M instructions`
              break
            case LOG_TYPE_RESPONSE_FROM_CACHE:
              appLog = parseNetworkAccessResponseFromCachePayload(log.payload)
              description = 'network access response retrieved from cache'
              break
            case LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND:
              appLog = parseNetworkAccessRequestExecutionInBackgroundPayload(log.payload)
              description = 'network access request executing in background'
              break
            case LOG_TYPE_REQUEST_EXECUTION:
              appLog = parseNetworkAccessRequestExecutedPayload(log.payload)
              executionTime =
                appLog.connectTimeMs && appLog.writeReadTimeMs ? appLog.connectTimeMs + appLog.writeReadTimeMs : null
              description = `network access request executed${executionTime ? ` in ${executionTime} ms` : ''}`
              break
            default:
              return
          }

          const prefix = {
            status: log.status === 'success' ? 'Success' : 'Failure',
            source: log.source,
            storeName,
            description,
            logTimestamp: formatLocalDate(log.log_timestamp),
          }

          setAppLogOutputs((prev) => [...prev, {appLog, prefix}])
        }
      }

      setTimeout(() => {
        poll({jwtToken: nextJwtToken, cursor: nextCursor || cursor, filters}).catch((error) => {
          throw error
        })
      }, retryIntervalMs)
    }

    poll({jwtToken: initialJwt, cursor: '', filters}).catch((error) => {
      throw error
    })
  }, [])

  return {appLogOutputs, errors}
}
