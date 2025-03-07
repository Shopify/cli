import {
  BackgroundExecutionReason,
  FunctionRunLog,
  NetworkAccessRequestExecutedLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  NetworkAccessResponseFromCacheLog,
  ErrorResponse,
  AppLogData,
} from './types.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../api/graphql/subscribe_to_app_logs.js'
import {AppInterface} from '../../models/app/app.js'
import {Response, shopifyFetch} from '@shopify/cli-kit/node/http'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {partnersFqdn, appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import camelcaseKeys from 'camelcase-keys'
import {formatLocalDate} from '@shopify/cli-kit/common/string'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

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

export function parseFunctionRunPayload(payload: string): FunctionRunLog {
  const parsedPayload = JSON.parse(payload)

  const parsedIqvValue =
    parsedPayload.input_query_variables_metafield_value &&
    parseJson(parsedPayload.input_query_variables_metafield_value)

  return new FunctionRunLog({
    export: parsedPayload.export,
    input: parsedPayload.input,
    inputBytes: parsedPayload.input_bytes,
    output: parsedPayload.output,
    outputBytes: parsedPayload.output_bytes,
    logs: parsedPayload.logs,
    functionId: parsedPayload.function_id,
    fuelConsumed: parsedPayload.fuel_consumed,
    errorMessage: parsedPayload.error_message,
    errorType: parsedPayload.error_type,
    inputQueryVariablesMetafieldValue: parsedIqvValue,
    inputQueryVariablesMetafieldNamespace: parsedPayload.input_query_variables_metafield_namespace,
    inputQueryVariablesMetafieldKey: parsedPayload.input_query_variables_metafield_key,
  })
}

export function parseNetworkAccessResponseFromCachePayload(payload: string): NetworkAccessResponseFromCacheLog {
  const parsedPayload = JSON.parse(payload)
  return new NetworkAccessResponseFromCacheLog({
    cacheEntryEpochMs: parsedPayload.cache_entry_epoch_ms,
    cacheTtlMs: parsedPayload.cache_ttl_ms,
    httpRequest: parsedPayload.http_request,
    httpResponse: parsedPayload.http_response,
  })
}

const reasonStringToEnum: {[key: string]: BackgroundExecutionReason} = {
  no_cached_response: BackgroundExecutionReason.NoCachedResponse,
  cached_response_about_to_expire: BackgroundExecutionReason.CacheAboutToExpire,
}

export function parseNetworkAccessRequestExecutionInBackgroundPayload(
  payload: string,
): NetworkAccessRequestExecutionInBackgroundLog {
  const parsedPayload = JSON.parse(payload)
  return new NetworkAccessRequestExecutionInBackgroundLog({
    reason: reasonStringToEnum[parsedPayload.reason] ?? BackgroundExecutionReason.Unknown,
    httpRequest: parsedPayload.http_request,
  })
}

export function parseNetworkAccessRequestExecutedPayload(payload: string): NetworkAccessRequestExecutedLog {
  const parsedPayload = JSON.parse(payload)
  return new NetworkAccessRequestExecutedLog({
    attempt: parsedPayload.attempt,
    connectTimeMs: parsedPayload.connect_time_ms || null,
    writeReadTimeMs: parsedPayload.write_read_time_ms || null,
    httpRequest: parsedPayload.http_request,
    httpResponse: parsedPayload.http_response || null,
    error: parsedPayload.error || null,
  })
}

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

const generateFetchAppLogUrlDevDashboard = async (
  organizationId: string,
  appId: string,
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
) => {
  const fqdn = await appManagementFqdn()
  let url = `https://${fqdn}/functions/unstable/organizations/${organizationId}/${appId}/app_logs/poll`

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
  const userAgent = `Shopify CLI; v=${CLI_KIT_VERSION}`
  const headers = {
    Authorization: `Bearer ${jwtToken}`,
    'User-Agent': userAgent,
  }
  return shopifyFetch(
    url,
    {
      method: 'GET',
      headers,
    },
    'non-blocking',
  )
}

export const fetchAppLogsDevDashboard = async (
  jwtToken: string,
  organizationId: string,
  appId: string,
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
): Promise<Response> => {
  const url = await generateFetchAppLogUrlDevDashboard(organizationId, appId, cursor, filters)
  const userAgent = `Shopify CLI; v=${CLI_KIT_VERSION}`

  const headers = {
    Authorization: `Bearer ${jwtToken}`,
    'User-Agent': userAgent,
  }

  return shopifyFetch(url, {
    method: 'GET',
    headers,
  })
}

interface FetchAppLogsErrorOptions {
  response: ErrorResponse
  onThrottle: (retryIntervalMs: number) => void
  onUnknownError: (retryIntervalMs: number) => void
  onResubscribe: () => Promise<string>
}

export const handleFetchAppLogsError = async (
  input: FetchAppLogsErrorOptions,
): Promise<{retryIntervalMs: number; nextJwtToken: string | null}> => {
  const {errors} = input.response

  console.log("errors", errors)

  let retryIntervalMs = POLLING_INTERVAL_MS
  let nextJwtToken = null

  if (errors.length > 0) {
    outputDebug(`Errors: ${errors.map((error) => error.message).join(', ')}`)

    if (errors.some((error) => error.status === 401)) {
      nextJwtToken = await input.onResubscribe()
    } else if (errors.some((error) => error.status === 429)) {
      retryIntervalMs = POLLING_THROTTLE_RETRY_INTERVAL_MS
      input.onThrottle(retryIntervalMs)
    } else {
      retryIntervalMs = POLLING_ERROR_RETRY_INTERVAL_MS
      input.onUnknownError(retryIntervalMs)
    }
  }

  return {retryIntervalMs, nextJwtToken}
}

export function sourcesForApp(app: AppInterface): string[] {
  return app.allExtensions.flatMap((extension) => {
    return extension.isFunctionExtension ? [`extensions.${extension.configuration.handle}`] : []
  })
}

export const toFormattedAppLogJson = ({
  appLog,
  appLogPayload,
  storeName,
  prettyPrint = true,
}: {
  appLog: AppLogData
  appLogPayload: unknown
  prettyPrint: boolean
  storeName: string
}): string => {
  const {cursor: _, ...appLogWithoutCursor} = appLog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toSaveData: any = camelcaseKeys({
    ...appLogWithoutCursor,
    payload: appLogPayload,
    localTime: formatLocalDate(appLog.log_timestamp),
    storeName,
  })

  if (appLogPayload instanceof FunctionRunLog) {
    toSaveData.payload.logs = appLogPayload.logs.split('\n').filter(Boolean)

    if (toSaveData.payload.inputQueryVariablesMetafieldValue) {
      toSaveData.payload.inputQueryVariablesMetafieldValue = parseJson(
        toSaveData.payload.inputQueryVariablesMetafieldValue,
      )
    }
  }

  if (prettyPrint) {
    return JSON.stringify(toSaveData, null, 2)
  } else {
    return JSON.stringify(toSaveData)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseAppLogPayload = (payload: string, logType: string): any => {
  const parsedPayload = camelcaseKeys(JSON.parse(payload))

  if (logType === LOG_TYPE_FUNCTION_RUN) {
    return new FunctionRunLog(parsedPayload)
  } else if (logType === LOG_TYPE_RESPONSE_FROM_CACHE) {
    return new NetworkAccessResponseFromCacheLog(parsedPayload)
  } else if (logType === LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND) {
    return new NetworkAccessRequestExecutionInBackgroundLog(parsedPayload)
  } else if (logType === LOG_TYPE_REQUEST_EXECUTION) {
    return new NetworkAccessRequestExecutedLog(parsedPayload)
  } else {
    return parsedPayload
  }
}

export const subscribeToAppLogs = async (
  developerPlatformClient: DeveloperPlatformClient,
  variables: AppLogsSubscribeVariables,
  organizationId: string,
): Promise<string> => {
  const result = await developerPlatformClient.subscribeToAppLogs(variables, organizationId)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  console.log("jwt subscribed?", jwtToken)
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${variables.apiKey}\n`)
  if (errors && errors.length > 0) {
    const errorOutput = errors.join(', ')
    outputWarn(`Errors subscribing to app logs: ${errorOutput}`)
    outputWarn('App log streaming is not available in this session.')
    throw new AbortError(errorOutput)
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${variables.shopIds.join(', ')}`)
    outputDebug(`Success: ${success}\n`)
  }
  return jwtToken
}

export function prettyPrintJsonIfPossible(json: unknown) {
  try {
    if (typeof json === 'string') {
      const jsonObject = JSON.parse(json)
      return JSON.stringify(jsonObject, null, 2)
    } else if (typeof json === 'object' && json !== null) {
      return JSON.stringify(json, null, 2)
    } else {
      return json
    }
  } catch (error) {
    throw new Error(`Error parsing JSON: ${error as string}`)
  }
}

const parseJson = (json: string): object | string => {
  try {
    return JSON.parse(json)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return json
  }
}
