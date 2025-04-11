import {pollAppLogs} from './poll-app-logs.js'
import {PollOptions, SubscribeOptions, ErrorResponse, SuccessResponse} from '../types.js'
import {
  POLLING_INTERVAL_MS,
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
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
  storeNameById: Map<string, string>
  organizationId: string
}): Promise<void> {
  const response = await pollAppLogs({pollOptions, developerPlatformClient, organizationId})
  let retryIntervalMs = POLLING_INTERVAL_MS
  let nextJwtToken = pollOptions.jwtToken

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

    if (result.nextJwtToken) {
      nextJwtToken = result.nextJwtToken
    }
    retryIntervalMs = result.retryIntervalMs
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
    }).catch((error) => {
      throw error
    })
  }, retryIntervalMs)
}
