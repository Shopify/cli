import {pollAppLogs} from './poll-app-logs.js'
import {PollOptions, SubscribeOptions, ErrorResponse, SuccessResponse} from '../types.js'
import {
  POLLING_INTERVAL_MS,
  handleFetchAppLogsError,
  subscribeToAppLogs,
  toFormattedAppLogJson,
  parseAppLogPayload,
} from '../utils.js'
import {outputInfo} from '@shopify/cli-kit/node/output'

export async function renderJsonLogs({
  pollOptions: {cursor, filters, jwtToken},
  options: {variables, developerPlatformClient, organizationId},
  storeNameById,
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
  storeNameById: Map<string, string>
}): Promise<void> {
  const response = await pollAppLogs({cursor, filters, jwtToken})
  let retryIntervalMs = POLLING_INTERVAL_MS
  let nextJwtToken = jwtToken

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

      outputInfo(
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
      options: {variables, developerPlatformClient, organizationId},
      pollOptions: {
        jwtToken: nextJwtToken || jwtToken,
        cursor: nextCursor || cursor,
        filters,
      },
      storeNameById,
    }).catch((error) => {
      throw error
    })
  }, retryIntervalMs)
}
