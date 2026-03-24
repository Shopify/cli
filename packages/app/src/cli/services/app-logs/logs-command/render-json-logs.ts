import {pollAppLogs} from './poll-app-logs.js'
import {PollOptions, SubscribeOptions, ErrorResponse, SuccessResponse} from '../types.js'
import {
  POLLING_INTERVAL_MS,
  MAX_CONSECUTIVE_RESUBSCRIBE_FAILURES,
  handleFetchAppLogsError,
  subscribeToAppLogs,
  toFormattedAppLogJson,
  parseAppLogPayload,
} from '../utils.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'

export async function renderJsonLogs({
  pollOptions,
  options: {variables, developerPlatformClient},
  storeNameById,
  organizationId,
  consecutiveResubscribeFailures = 0,
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
  storeNameById: Map<string, string>
  organizationId: string
  consecutiveResubscribeFailures?: number
}): Promise<void> {
  const response = await pollAppLogs({pollOptions, developerPlatformClient, organizationId})
  let retryIntervalMs = POLLING_INTERVAL_MS
  let nextJwtToken = pollOptions.jwtToken
  let nextConsecutiveResubscribeFailures = consecutiveResubscribeFailures

  const errorResponse = response as ErrorResponse

  if (errorResponse.errors) {
    const result = await handleFetchAppLogsError({
      response: errorResponse,
      onThrottle: (retryIntervalMs) => {
        outputInfo(JSON.stringify({message: 'Request throttled while polling app logs.', retry_in_ms: retryIntervalMs}))
      },
      onUnknownError: (retryIntervalMs) => {
        outputInfo(JSON.stringify({message: 'Error while polling app logs.', retry_in_ms: retryIntervalMs}))
      },
      onResubscribe: () => {
        return subscribeToAppLogs(developerPlatformClient, variables, organizationId)
      },
    })

    if (result.resubscribeResult === 'failed') {
      nextConsecutiveResubscribeFailures += 1
      if (nextConsecutiveResubscribeFailures >= MAX_CONSECUTIVE_RESUBSCRIBE_FAILURES) {
        outputInfo(JSON.stringify({message: 'App log streaming session has expired. Please restart your dev session.'}))
        return
      }
    } else if (result.resubscribeResult === 'succeeded') {
      nextConsecutiveResubscribeFailures = 0
    }

    if (result.nextJwtToken) {
      nextJwtToken = result.nextJwtToken
    }
    retryIntervalMs = result.retryIntervalMs
  } else {
    nextConsecutiveResubscribeFailures = 0
  }

  const {cursor: nextCursor, appLogs} = response as SuccessResponse

  if (appLogs) {
    appLogs.forEach((log) => {
      const storeName = storeNameById.get(log.shop_id?.toString())
      if (storeName === undefined) {
        return
      }

      outputResult(
        toFormattedAppLogJson({
          appLog: log,
          appLogPayload: parseAppLogPayload(log.payload, log.log_type),
          storeName,
          prettyPrint: false,
        }),
      )
    })
  }

  setTimeout(() => {
    renderJsonLogs({
      options: {variables, developerPlatformClient},
      pollOptions: {
        jwtToken: nextJwtToken || pollOptions.jwtToken,
        cursor: nextCursor || pollOptions.cursor,
        filters: pollOptions.filters,
      },
      storeNameById,
      organizationId,
      consecutiveResubscribeFailures: nextConsecutiveResubscribeFailures,
    }).catch((error) => {
      throw error
    })
  }, retryIntervalMs)
}
