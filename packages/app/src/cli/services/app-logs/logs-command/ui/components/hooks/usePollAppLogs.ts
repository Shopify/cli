import {
  POLLING_ERROR_RETRY_INTERVAL_MS,
  ONE_MILLION,
  POLLING_INTERVAL_MS,
  POLLING_THROTTLE_RETRY_INTERVAL_MS,
  parseFunctionRunPayload,
} from '../../../../utils.js'
import {ErrorResponse, SuccessResponse, AppLogOutput, PollFilters} from '../../../../types.js'
import {pollAppLogs} from '../../../poll-app-logs.js'
import {useState, useEffect} from 'react'

interface UsePollAppLogsOptions {
  initialJwt: string
  filters: PollFilters
  resubscribeCallback: () => Promise<string>
}

export function usePollAppLogs({initialJwt, filters, resubscribeCallback}: UsePollAppLogsOptions) {
  const [errors, setErrors] = useState<string[]>([])
  const [appLogOutputs, setAppLogOutputs] = useState<AppLogOutput[]>([])

  useEffect(() => {
    const poll = async ({jwtToken, cursor, filters}: {jwtToken: string; cursor?: string; filters: PollFilters}) => {
      let nextInterval = POLLING_INTERVAL_MS
      let nextJwtToken = jwtToken
      const response = await pollAppLogs({jwtToken, cursor, filters})

      const {errors} = response as ErrorResponse

      if (errors && errors.length > 0) {
        const errorsStrings = errors.map((error) => error.message)
        if (errors.some((error) => error.status === 429)) {
          setErrors([...errorsStrings, `Retrying in ${POLLING_THROTTLE_RETRY_INTERVAL_MS / 1000}s`])
          nextInterval = POLLING_THROTTLE_RETRY_INTERVAL_MS
        } else if (errors.some((error) => error.status === 401)) {
          nextJwtToken = await resubscribeCallback()
        } else {
          setErrors([...errorsStrings, `Retrying in ${POLLING_ERROR_RETRY_INTERVAL_MS / 1000}s`])
          nextInterval = POLLING_ERROR_RETRY_INTERVAL_MS
        }
      } else {
        setErrors([])
      }

      const {cursor: nextCursor, appLogs} = response as SuccessResponse

      if (appLogs) {
        for (const log of appLogs) {
          const appLog = parseFunctionRunPayload(log.payload)
          const fuel = (appLog.fuelConsumed / ONE_MILLION).toFixed(4)
          const prefix = {
            status: log.status === 'success' ? 'Success' : 'Failure',
            source: log.source,
            description: `in ${fuel} M instructions`,
            logTimestamp: log.log_timestamp,
          }

          setAppLogOutputs((prev) => [...prev, {appLog, prefix}])
        }
      }

      setTimeout(() => {
        poll({jwtToken: nextJwtToken, cursor: nextCursor || cursor, filters}).catch((error) => {
          throw error
        })
      }, nextInterval)
    }

    poll({jwtToken: initialJwt, cursor: '', filters}).catch((error) => {
      throw error
    })
  }, [])

  return {appLogOutputs, errors}
}
