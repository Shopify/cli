import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../api/graphql/subscribe_to_app_logs.js'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'

export const POLLING_INTERVAL_MS = 450
export const POLLING_ERROR_RETRY_INTERVAL_MS = 5 * 1000
export const POLLING_THROTTLE_RETRY_INTERVAL_MS = 60 * 1000
export const ONE_MILLION = 1000000
export const LOG_TYPE_FUNCTION_RUN = 'function_run'
export const LOG_TYPE_FUNCTION_NETWORK_ACCESS = 'function_network_access'
export const LOG_TYPE_RESPONSE_FROM_CACHE = 'function_network_access.response_from_cache'
export const LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND = 'function_network_access.request_execution_in_background'
export const LOG_TYPE_REQUEST_EXECUTION = 'function_network_access.request_execution'
export const REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHED_RESPONSE_REASON = 'no_cached_response'
export const REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_REASON = 'cached_response_about_to_expire'

const generateFetchAppLogUrl = async (
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
) => {
  const fqdn = await partnersFqdn()
  let url = `https://${fqdn}/app_logs/poll`

  if (!cursor) {
    return url
  }

  url += `?cursor=${cursor}`

  if (filters?.status) {
    url += `&status=${filters.status}`
  }
  if (filters?.source) {
    url += `&source=${filters.source}`
  }

  return url
}

export const fetchAppLogs = async (
  jwtToken: string,
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
): Promise<Response> => {
  const url = await generateFetchAppLogUrl(cursor, filters)
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })
}

export const subscribeToAppLogs = async (
  developerPlatformClient: DeveloperPlatformClient,
  variables: AppLogsSubscribeVariables,
): Promise<string> => {
  const result = await developerPlatformClient.subscribeToAppLogs(variables)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${variables.apiKey}\n`)
  if (errors && errors.length > 0) {
    const errorOutput = errors.join(', ')
    outputWarn(`Errors subscribing to app logs: ${errorOutput}`)
    outputWarn('App log streaming is not available in this session.')
    throw new AbortError(errorOutput)
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${variables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }
  return jwtToken
}
