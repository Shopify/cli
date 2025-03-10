import {usePollAppLogs} from './usePollAppLogs.js'
import {pollAppLogs} from '../../../poll-app-logs.js'
import {
  LOG_TYPE_REQUEST_EXECUTION,
  LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
  LOG_TYPE_RESPONSE_FROM_CACHE,
  POLLING_ERROR_RETRY_INTERVAL_MS,
  POLLING_INTERVAL_MS,
  POLLING_THROTTLE_RETRY_INTERVAL_MS,
  parseFunctionRunPayload,
} from '../../../../utils.js'
import {
  BackgroundExecutionReason,
  NetworkAccessRequestExecutedLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  NetworkAccessResponseFromCacheLog,
} from '../../../../types.js'
import {testDeveloperPlatformClient} from '../../../../../../models/app/app.test-data.js'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {test, describe, vi, beforeEach, afterEach, expect} from 'vitest'
import React from 'react'

vi.mock('../../../poll-app-logs.js')

const MOCKED_JWT_TOKEN = 'mockedJwtToken'
const NEW_JWT_TOKEN = 'newJwt'
const RETURNED_CURSOR = '2024-05-23T19:17:02.321773Z'
const FUNCTION_ID = 'e57b4d31-2038-49ff-a0a1-1eea532414f7'
const FUEL_CONSUMED = 512436
const TIME = '2024-06-18 16:02:04'

const LOG_TYPE = 'function_run'
const STATUS = 'success'
const SOURCE = 'my-function'
const LOGS = 'test logs'
const OUTPUT = {test: 'output'}
const INPUT = {test: 'input'}
const INPUT_BYTES = 10
const OUTPUT_BYTES = 10

const NETWORK_ACCESS_HTTP_REQUEST = {
  url: 'https://api.example.com/hello',
  method: 'GET',
  headers: {},
  body: null,
  policy: {
    read_timeout_ms: 500,
  },
}
const NETWORK_ACCESS_HTTP_RESPONSE = {
  status: 200,
  body: 'Success',
  headers: {
    header1: 'value1',
  },
}

const NETWORK_ACCESS_REQUEST_EXECUTION_SUCCESS_PAYLOAD = {
  attempt: 1,
  connect_time_ms: 40,
  write_read_time_ms: 40,
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
  http_response: NETWORK_ACCESS_HTTP_RESPONSE,
}
const NETWORK_ACCESS_REQUEST_EXECUTION_FAILURE_PAYLOAD = {
  attempt: 1,
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
  error: 'Timeout Error',
}

const NETWORK_ACCESS_RESPONSE_FROM_CACHE_PAYLOAD = {
  cache_entry_epoch_ms: 1683904621000,
  cache_ttl_ms: 300000,
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
  http_response: NETWORK_ACCESS_HTTP_RESPONSE,
}

const NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHE_PAYLOAD = {
  reason: 'no_cached_response',
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
}

const NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_PAYLOAD = {
  reason: 'cached_response_about_to_expire',
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
}

const POLL_APP_LOGS_FOR_LOGS_RESPONSE = {
  cursor: RETURNED_CURSOR,
  appLogs: [
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify({
        export: 'run',
        input: INPUT,
        input_bytes: INPUT_BYTES,
        output: OUTPUT,
        output_bytes: OUTPUT_BYTES,
        function_id: FUNCTION_ID,
        logs: LOGS,
        fuel_consumed: FUEL_CONSUMED,
      }),
      log_type: LOG_TYPE,
      cursor: RETURNED_CURSOR,
      status: STATUS,
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_RESPONSE_FROM_CACHE_PAYLOAD),
      log_type: LOG_TYPE_RESPONSE_FROM_CACHE,
      cursor: RETURNED_CURSOR,
      status: STATUS,
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_SUCCESS_PAYLOAD),
      log_type: LOG_TYPE_REQUEST_EXECUTION,
      cursor: RETURNED_CURSOR,
      status: STATUS,
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_FAILURE_PAYLOAD),
      log_type: LOG_TYPE_REQUEST_EXECUTION,
      cursor: RETURNED_CURSOR,
      status: 'failure',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHE_PAYLOAD),
      log_type: LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
      cursor: RETURNED_CURSOR,
      status: STATUS,
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_PAYLOAD),
      log_type: LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
      cursor: RETURNED_CURSOR,
      status: STATUS,
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: TIME,
    },
  ],
}

const MOCKED_ORGANIZATION_ID = '123'
const MOCKED_APP_ID = '456'

const POLL_APP_LOGS_FOR_LOGS_401_RESPONSE = {
  errors: [{status: 401, message: 'Unauthorized'}],
}

const POLL_APP_LOGS_FOR_LOGS_429_RESPONSE = {
  errors: [{status: 429, message: 'Error Message'}],
}

const POLL_APP_LOGS_FOR_LOGS_UNKNOWN_RESPONSE = {
  errors: [{status: 422, message: 'Unprocessable'}],
}

const STORE_NAME = 'Test Store'
const STORE_ID = '1'
const STORE_NAME_BY_ID = new Map([[STORE_ID, STORE_NAME]])

const EMPTY_FILTERS = {status: undefined, sources: undefined}

describe('usePollAppLogs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('returns logs on successful poll', async () => {
    const mockedPollAppLogs = vi.fn().mockResolvedValue(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    const resubscribeCallback = vi.fn().mockResolvedValue(NEW_JWT_TOKEN)

    const hook = renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback,
        storeNameById: STORE_NAME_BY_ID,
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    expect(mockedPollAppLogs).toHaveBeenCalledTimes(1)

    expect(hook.lastResult?.appLogOutputs).toHaveLength(6)

    expect(hook.lastResult?.appLogOutputs[0]!.appLog).toEqual(
      parseFunctionRunPayload(POLL_APP_LOGS_FOR_LOGS_RESPONSE.appLogs[0]!.payload),
    )
    expect(hook.lastResult?.appLogOutputs[0]!.prefix).toEqual({
      status: 'Success',
      source: SOURCE,
      description: `export "run" executed in ${(FUEL_CONSUMED / 1000000).toFixed(4)}M instructions`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(hook.lastResult?.appLogOutputs[1]!.appLog).toEqual(
      new NetworkAccessResponseFromCacheLog({
        cacheEntryEpochMs: 1683904621000,
        cacheTtlMs: 300000,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: NETWORK_ACCESS_HTTP_RESPONSE,
      }),
    )
    expect(hook.lastResult?.appLogOutputs[1]!.prefix).toEqual({
      status: 'Success',
      source: SOURCE,
      description: `network access response retrieved from cache`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(hook.lastResult?.appLogOutputs[2]!.appLog).toEqual(
      new NetworkAccessRequestExecutedLog({
        attempt: 1,
        connectTimeMs: 40,
        writeReadTimeMs: 40,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: NETWORK_ACCESS_HTTP_RESPONSE,
        error: null,
      }),
    )
    expect(hook.lastResult?.appLogOutputs[2]!.prefix).toEqual({
      status: 'Success',
      source: SOURCE,
      description: `network access request executed in 80 ms`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(hook.lastResult?.appLogOutputs[3]!.appLog).toEqual(
      new NetworkAccessRequestExecutedLog({
        attempt: 1,
        connectTimeMs: null,
        writeReadTimeMs: null,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: null,
        error: 'Timeout Error',
      }),
    )
    expect(hook.lastResult?.appLogOutputs[3]!.prefix).toEqual({
      status: 'Failure',
      source: SOURCE,
      description: `network access request executed`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(hook.lastResult?.appLogOutputs[4]!.appLog).toEqual(
      new NetworkAccessRequestExecutionInBackgroundLog({
        reason: BackgroundExecutionReason.NoCachedResponse,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
      }),
    )
    expect(hook.lastResult?.appLogOutputs[4]!.prefix).toEqual({
      status: 'Success',
      source: SOURCE,
      description: `network access request executing in background`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(hook.lastResult?.appLogOutputs[5]!.appLog).toEqual(
      new NetworkAccessRequestExecutionInBackgroundLog({
        reason: BackgroundExecutionReason.CacheAboutToExpire,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
      }),
    )
    expect(hook.lastResult?.appLogOutputs[5]!.prefix).toEqual({
      status: 'Success',
      source: SOURCE,
      description: `network access request executing in background`,
      logTimestamp: TIME,
      storeName: STORE_NAME,
    })

    expect(vi.getTimerCount()).toEqual(1)
  })

  test('refreshes jwt after 401', async () => {
    const mockedPollAppLogs = vi
      .fn()
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_401_RESPONSE)
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const resubscribeCallback = vi.fn().mockResolvedValue(NEW_JWT_TOKEN)
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback,
        storeNameById: STORE_NAME_BY_ID,
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Initial invocation, 401 returned
    expect(mockedPollAppLogs).toHaveBeenNthCalledWith(1, {
      pollOptions: {
        jwtToken: MOCKED_JWT_TOKEN,
        cursor: '',
        filters: EMPTY_FILTERS,
      },
      developerPlatformClient: mockedDeveloperPlatformClient,
      organizationId: MOCKED_ORGANIZATION_ID,
      appId: MOCKED_APP_ID,
    })
    expect(resubscribeCallback).toHaveBeenCalledOnce()

    // Follow up invocation, which invokes resubscribeCallback
    await vi.advanceTimersToNextTimerAsync()
    expect(mockedPollAppLogs).toHaveBeenNthCalledWith(2, {
      pollOptions: {jwtToken: NEW_JWT_TOKEN, cursor: '', filters: EMPTY_FILTERS},
      developerPlatformClient: mockedDeveloperPlatformClient,
      organizationId: MOCKED_ORGANIZATION_ID,
      appId: MOCKED_APP_ID,
    })

    expect(vi.getTimerCount()).toEqual(1)
  })

  test('retries after throttle interval on 429', async () => {
    const mockedPollAppLogs = vi
      .fn()
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_429_RESPONSE)
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    const timeoutSpy = vi.spyOn(global, 'setTimeout')

    const resubscribeCallback = vi.fn().mockResolvedValue(NEW_JWT_TOKEN)

    const hook = renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback,
        storeNameById: STORE_NAME_BY_ID,
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Initial invocation, 429 returned
    expect(mockedPollAppLogs).toHaveBeenCalledTimes(1)

    expect(hook.lastResult?.appLogOutputs).toHaveLength(0)
    expect(hook.lastResult?.errors[0]).toEqual('Request throttled while polling app logs.')
    expect(hook.lastResult?.errors[1]).toEqual('Retrying in 60s')

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), POLLING_THROTTLE_RETRY_INTERVAL_MS)

    await vi.advanceTimersToNextTimerAsync()
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), POLLING_INTERVAL_MS)

    expect(vi.getTimerCount()).toEqual(1)
    timeoutSpy.mockRestore()
  })

  test('retries after unknown error', async () => {
    const mockedPollAppLogs = vi
      .fn()
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_UNKNOWN_RESPONSE)
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    const timeoutSpy = vi.spyOn(global, 'setTimeout')

    const resubscribeCallback = vi.fn().mockResolvedValue(NEW_JWT_TOKEN)

    const hook = renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback,
        storeNameById: STORE_NAME_BY_ID,
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    // Initial invocation, 422 returned
    expect(mockedPollAppLogs).toHaveBeenCalledTimes(1)

    expect(hook.lastResult?.appLogOutputs).toHaveLength(0)
    expect(hook.lastResult?.errors[0]).toEqual('Error while polling app logs')
    expect(hook.lastResult?.errors[1]).toEqual('Retrying in 5s')

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), POLLING_ERROR_RETRY_INTERVAL_MS)

    await vi.advanceTimersToNextTimerAsync()
    expect(hook.lastResult?.appLogOutputs).toHaveLength(6)
    expect(hook.lastResult?.errors).toHaveLength(0)
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), POLLING_INTERVAL_MS)

    expect(vi.getTimerCount()).toEqual(1)
    timeoutSpy.mockRestore()
  })

  test('clears error on success', async () => {
    const mockedPollAppLogs = vi
      .fn()
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_429_RESPONSE)
      .mockResolvedValueOnce(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    const hook = renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback: vi.fn().mockResolvedValue(MOCKED_JWT_TOKEN),
        storeNameById: STORE_NAME_BY_ID,
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // initial poll with errors
    await vi.advanceTimersByTimeAsync(0)
    expect(hook.lastResult?.errors).toHaveLength(2)

    // second poll with no errors
    await vi.advanceTimersToNextTimerAsync()
    expect(hook.lastResult?.errors).toHaveLength(0)
  })

  test("ignores logs from stores that don't have a matching shop name", async () => {
    const mockedPollAppLogs = vi.fn().mockResolvedValue(POLL_APP_LOGS_FOR_LOGS_RESPONSE)
    vi.mocked(pollAppLogs).mockImplementation(mockedPollAppLogs)

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()

    const resubscribeCallback = vi.fn().mockResolvedValue(NEW_JWT_TOKEN)

    const hook = renderHook(() =>
      usePollAppLogs({
        initialJwt: MOCKED_JWT_TOKEN,
        filters: EMPTY_FILTERS,
        resubscribeCallback,
        storeNameById: new Map(),
        developerPlatformClient: mockedDeveloperPlatformClient,
        organizationId: MOCKED_ORGANIZATION_ID,
        appId: MOCKED_APP_ID,
      }),
    )

    // needed to await the render
    await vi.advanceTimersByTimeAsync(0)

    expect(hook.lastResult?.appLogOutputs).toHaveLength(0)
    expect(mockedPollAppLogs).toHaveBeenCalledTimes(1)
  })
})

function renderHook<THookResult>(renderHookCallback: () => THookResult) {
  const result: {
    lastResult: THookResult | undefined
  } = {
    lastResult: undefined,
  }

  const MockComponent = () => {
    const hookResult = renderHookCallback()
    result.lastResult = hookResult

    return null
  }

  render(<MockComponent />)

  return result
}
