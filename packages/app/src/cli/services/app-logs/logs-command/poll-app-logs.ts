import {PollOptions, AppLogData, PollResponse, PollFilters} from '../types.js'
import {AppLogsError, AppLogsSuccess, DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface PollAppLogsOptions {
  pollOptions: PollOptions
  developerPlatformClient: DeveloperPlatformClient
  organizationId: string
  appId: string
}

export const pollAppLogs = async ({
  pollOptions: {jwtToken, cursor, filters},
  developerPlatformClient,
  organizationId,
  appId,
}: PollAppLogsOptions): Promise<PollResponse> => {
  const response = await developerPlatformClient.appLogs({jwtToken, cursor}, organizationId, appId)
  const {errors, status} = response as AppLogsError

  if (status !== 200) {
    if (status === 401 || status === 429 || status >= 500) {
      return {
        errors: errors.map((error) => ({status, message: error})),
      }
    } else {
      throw new AbortError(`${errors.join(', ')} while fetching app logs`)
    }
  }

  const {cursor: responseCursor, app_logs: appLogs} = response as AppLogsSuccess
  const filteredLogs = filterLogs(appLogs, filters)

  return {
    cursor: responseCursor,
    appLogs: filteredLogs,
  }
}

function filterLogs(appLogs: AppLogData[], filters: PollFilters) {
  let filterLogs: AppLogData[] = appLogs

  if (filters.status !== undefined || filters.sources !== undefined) {
    filterLogs = filterLogs.filter((log) => {
      const statusMatch = filters.status === undefined ? true : log.status === filters.status
      const sourceMatch =
        filters.sources === undefined ? true : filters.sources.includes(`${log.source_namespace}.${log.source}`)
      return statusMatch && sourceMatch
    })
  }

  return filterLogs
}
