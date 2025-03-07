import {OrganizationSource} from '../../../models/organization.js'
import {PollOptions, AppLogData, PollResponse, PollFilters} from '../types.js'
import {fetchAppLogs, fetchAppLogsDevDashboard} from '../utils.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Response} from '@shopify/cli-kit/node/http'

export const pollAppLogs = async ({
  pollOptions: {jwtToken, cursor, filters},
  options: {organizationSource, orgId, appId},
}: {
  pollOptions: PollOptions
  options: {organizationSource: OrganizationSource; orgId: string; appId: string}
}): Promise<PollResponse> => {
  const isDevDashboard = organizationSource === OrganizationSource.BusinessPlatform

  const response: Response = isDevDashboard
    ? await fetchAppLogsDevDashboard(jwtToken, orgId, appId, cursor)
    : await fetchAppLogs(jwtToken, cursor)

  const responseJson = await response.json()
  if (!response.ok) {
    const errorResponse = responseJson as {
      errors: string[]
    }
    if (response.status === 401 || response.status === 429 || response.status >= 500) {
      return {
        errors: [{status: response.status, message: errorResponse.errors.join(', ')}],
      }
    } else {
      throw new AbortError(`${errorResponse.errors.join(', ')} while fetching app logs`)
    }
  }

  const data = responseJson as {
    app_logs: AppLogData[]
    cursor?: string
  }

  const filteredLogs = filterLogs(data.app_logs, filters)

  return {
    cursor: data.cursor,
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
