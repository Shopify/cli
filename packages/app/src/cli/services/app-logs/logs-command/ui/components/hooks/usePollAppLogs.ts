import {useSelfAdjustingInterval} from './useSelfAdjustingInterval.js'
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
import {DeveloperPlatformClient} from '../../../../../../utilities/developer-platform-client.js'
import {ErrorResponse, SuccessResponse, AppLogOutput, PollFilters, AppLogPayload} from '../../../../types.js'
import {pollAppLogs} from '../../../poll-app-logs.js'
import {useState, Dispatch, SetStateAction, useRef, useCallback} from 'react'
import {formatLocalDate} from '@shopify/cli-kit/common/string'

interface UsePollAppLogsOptions {
  initialJwt: string
  filters: PollFilters
  resubscribeCallback: () => Promise<string>
  storeNameById: Map<string, string>
  developerPlatformClient: DeveloperPlatformClient
}

async function performPoll({
  jwtToken,
  cursor,
  filters,
  storeNameById,
  setErrors,
  setAppLogOutputs,
  resubscribeCallback,
  developerPlatformClient,
}: {
  jwtToken: string
  cursor?: string
  filters: PollFilters
  storeNameById: Map<string, string>
  setErrors: Dispatch<SetStateAction<string[]>>
  setAppLogOutputs: Dispatch<SetStateAction<AppLogOutput[]>>
  resubscribeCallback: () => Promise<string>
  developerPlatformClient: DeveloperPlatformClient
}) {
  let nextJwtToken = jwtToken
  let retryIntervalMs = POLLING_INTERVAL_MS
  let nextCursor = cursor
  const response = await pollAppLogs({pollOptions: {jwtToken, cursor, filters}, developerPlatformClient})

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

    const {appLogs} = response as SuccessResponse
    nextCursor = (response as SuccessResponse).cursor

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
            continue
        }

        const prefix = {
          status: log.status === 'success' ? 'Success' : 'Failure',
          source: log.source,
          storeName,
          description,
          logTimestamp: formatLocalDate(log.log_timestamp),
        }

        if (appLog) {
          setAppLogOutputs((prev) => [...prev, {appLog, prefix}])
        }
      }
    }
  }

  return {nextJwtToken, retryIntervalMs, cursor: nextCursor ?? cursor}
}

export function usePollAppLogs({
  initialJwt,
  filters,
  resubscribeCallback,
  storeNameById,
  developerPlatformClient,
}: UsePollAppLogsOptions) {
  const [errors, setErrors] = useState<string[]>([])
  const [appLogOutputs, setAppLogOutputs] = useState<AppLogOutput[]>([])
  const nextJwtToken = useRef(initialJwt)
  const retryIntervalMs = useRef(0)
  const cursor = useRef<string | undefined>('')

  const performPollCallback = useCallback(async () => {
    const res = await performPoll({
      jwtToken: nextJwtToken.current,
      cursor: cursor.current,
      filters,
      storeNameById,
      setErrors,
      setAppLogOutputs,
      resubscribeCallback,
      developerPlatformClient,
    })

    // ESLint is concerned about these updates being atomic, but the approach to useSelfAdjustingInterval ensures that is the case.
    // eslint-disable-next-line require-atomic-updates
    nextJwtToken.current = res.nextJwtToken
    // eslint-disable-next-line require-atomic-updates
    cursor.current = res.cursor

    retryIntervalMs.current = res.retryIntervalMs

    return {retryIntervalMs: retryIntervalMs.current}
  }, [])

  useSelfAdjustingInterval(performPollCallback)

  return {appLogOutputs, errors}
}
