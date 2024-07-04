import {PollOptions, AppLogData, PollResponse} from '../types.js'
import {fetchAppLogs} from '../utils.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export const pollAppLogs = async ({jwtToken, cursor, filters}: PollOptions): Promise<PollResponse> => {
  const response = await fetchAppLogs(jwtToken, cursor, filters)

  const responseJson = await response.json()
  if (!response.ok) {
    const errorResponse = responseJson as {
      errors: string[]
    }
    if (response.status === 401 || response.status === 429 || response.status >= 500) {
      return {
        errors: [{status: response.status, message: `${errorResponse.errors.join(', ')}`}],
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

function filterLogs(appLogs: AppLogData[], filters: {status: string | undefined; source: string | undefined}) {
  let filterLogs: AppLogData[] = appLogs

  if (filters.status !== undefined || filters.source !== undefined) {
    filterLogs = filterLogs.filter((log) => {
      const statusMatch = filters.status === undefined ? true : log.status === filters.status
      const sourceMatch = filters.source === undefined ? true : log.source === filters.source
      return statusMatch && sourceMatch
    })
  }

  return filterLogs
}
