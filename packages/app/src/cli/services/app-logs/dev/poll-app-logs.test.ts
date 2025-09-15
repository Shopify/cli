import {pollAppLogs} from './poll-app-logs.js'
import {writeAppLogsToFile} from './write-app-logs.js'
import {FunctionRunLog} from '../types.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import * as components from '@shopify/cli-kit/node/ui/components'
import * as output from '@shopify/cli-kit/node/output'
import camelcaseKeys from 'camelcase-keys'

const JWT_TOKEN = 'jwtToken'
const API_KEY = 'apiKey'
const TEST_LOGS_DIR = '/test/logs/dir'

vi.mock('./write-app-logs.js')
vi.mock('@shopify/cli-kit/node/http')

const FQDN = await partnersFqdn()
const LOGS = '1\\n2\\n3\\n4\\n'
const FUNCTION_ERROR = 'function_error'
const FUNCTION_RUN = 'function_run'

const INPUT = {
  cart: {
    lines: [
      {
        quantity: 3,
        merchandise: {
          __typename: 'ProductVariant',
          id: 'gid:\\/\\/shopify\\/ProductVariant\\/2',
        },
      },
    ],
  },
}
const OUTPUT = {
  discountApplicationStrategy: 'FIRST',
  discounts: [
    {
      message: '10% off',
      value: {
        percentage: {
          value: 10,
        },
      },
      targets: [
        {
          productVariant: {
            id: 'gid://shopify/ProductVariant/2',
          },
        },
      ],
    },
  ],
}
const SOURCE = 'my-function'
const FUNCTION_PAYLOAD = {
  input: JSON.stringify(INPUT),
  input_bytes: 123,
  output: JSON.stringify(OUTPUT),
  output_bytes: 182,
  function_id: 'e57b4d31-2038-49ff-a0a1-1eea532414f7',
  logs: LOGS,
  fuel_consumed: 512436,
  export: 'run',
}
const FAILURE_PAYLOAD = {
  input: JSON.stringify(INPUT),
  input_bytes: 123,
  output: JSON.stringify(OUTPUT),
  output_bytes: 182,
  function_id: 'e57b4d31-2038-49ff-a0a1-1eea532414f7',
  logs: LOGS,
  error_type: FUNCTION_ERROR,
  export: 'run',
}

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
}

const NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHE_PAYLOAD = {
  reason: 'no_cached_response',
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
}

const NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_PAYLOAD = {
  reason: 'cached_response_about_to_expire',
  http_request: NETWORK_ACCESS_HTTP_REQUEST,
}

const OTHER_PAYLOAD = {some: 'arbitrary payload'}
const RETURNED_CURSOR = '2024-05-23T19:17:02.321773Z'
const RESPONSE_DATA = {
  app_logs: [
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(FUNCTION_PAYLOAD),
      log_type: FUNCTION_RUN,
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(FAILURE_PAYLOAD),
      log_type: FUNCTION_RUN,
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'failure',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_SUCCESS_PAYLOAD),
      log_type: 'function_network_access.request_execution',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_FAILURE_PAYLOAD),
      log_type: 'function_network_access.request_execution',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'failure',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_RESPONSE_FROM_CACHE_PAYLOAD),
      log_type: 'function_network_access.response_from_cache',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_CACHE_ABOUT_TO_EXPIRE_PAYLOAD),
      log_type: 'function_network_access.request_execution_in_background',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(NETWORK_ACCESS_REQUEST_EXECUTION_IN_BACKGROUND_NO_CACHE_PAYLOAD),
      log_type: 'function_network_access.request_execution_in_background',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(OTHER_PAYLOAD),
      log_type: 'some arbitrary event type',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'failure',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
  ],
  cursor: RETURNED_CURSOR,
  status: 200,
}
const MOCKED_RESUBSCRIBE_CALLBACK = vi.fn()

describe('pollAppLogs', () => {
  let stdout: any

  beforeEach(() => {
    stdout = {write: vi.fn()}
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  test('polls and re-polls the endpoint', async () => {
    const firstUrl = `https://${FQDN}/app_logs/poll`
    const secondUrl = `${firstUrl}?cursor=${RETURNED_CURSOR}`

    const developerPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValue(RESPONSE_DATA),
    })

    // Given
    vi.mocked(writeAppLogsToFile).mockResolvedValue({fullOutputPath: '/path', identifier: '000000'})
    vi.spyOn(components, 'useConcurrentOutputContext')

    // When
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      developerPlatformClient,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      storeName: 'storeName',
      organizationId: 'organizationId',
      logsDir: TEST_LOGS_DIR,
    })
    await vi.advanceTimersToNextTimerAsync()

    const appLogPayloadZero = new FunctionRunLog(
      camelcaseKeys(JSON.parse(RESPONSE_DATA.app_logs[0]!.payload), {deep: true}),
    )
    expect(writeAppLogsToFile).toHaveBeenCalledWith({
      appLog: RESPONSE_DATA.app_logs[0],
      appLogPayload: appLogPayloadZero,
      stdout,
      storeName: 'storeName',
      logsDir: TEST_LOGS_DIR,
    })

    const appLogPayloadOne = new FunctionRunLog(
      camelcaseKeys(JSON.parse(RESPONSE_DATA.app_logs[1]!.payload), {deep: true}),
    )
    expect(writeAppLogsToFile).toHaveBeenCalledWith({
      appLog: RESPONSE_DATA.app_logs[1],
      appLogPayload: appLogPayloadOne,
      stdout,
      storeName: 'storeName',
      logsDir: TEST_LOGS_DIR,
    })
    expect(writeAppLogsToFile).toHaveBeenCalledWith({
      appLog: RESPONSE_DATA.app_logs[2],
      appLogPayload: JSON.parse(RESPONSE_DATA.app_logs[2]!.payload),
      stdout,
      storeName: 'storeName',
      logsDir: TEST_LOGS_DIR,
    })

    expect(components.useConcurrentOutputContext).toHaveBeenCalledWith(
      {outputPrefix: SOURCE, stripAnsi: false},
      expect.any(Function),
    )

    // app_logs[0]
    expect(stdout.write).toHaveBeenNthCalledWith(
      1,
      'Function export "run" executed successfully using 0.5124M instructions.',
    )
    expect(stdout.write).toHaveBeenNthCalledWith(2, expect.stringContaining(LOGS))
    expect(stdout.write).toHaveBeenNthCalledWith(3, expect.stringContaining('Log: '))

    // app_logs[1]
    expect(stdout.write).toHaveBeenNthCalledWith(
      4,
      `❌ Function export "run" failed to execute with error: ${FUNCTION_ERROR}`,
    )
    expect(stdout.write).toHaveBeenNthCalledWith(5, expect.stringContaining(LOGS))
    expect(stdout.write).toHaveBeenNthCalledWith(6, expect.stringContaining('Log: '))

    // app_logs[2]
    expect(stdout.write).toHaveBeenNthCalledWith(7, 'Function network access request executed successfully.')
    expect(stdout.write).toHaveBeenNthCalledWith(8, expect.stringContaining('Log: '))

    // app_logs[3]
    expect(stdout.write).toHaveBeenNthCalledWith(
      9,
      '❌ Function network access request failed to execute with error: Timeout Error.',
    )
    expect(stdout.write).toHaveBeenNthCalledWith(10, expect.stringContaining('Log: '))

    // app_logs[4]
    expect(stdout.write).toHaveBeenNthCalledWith(11, 'Function network access response retrieved from cache.')
    expect(stdout.write).toHaveBeenNthCalledWith(12, expect.stringContaining('Log: '))

    // app_logs[5]
    expect(stdout.write).toHaveBeenNthCalledWith(
      13,
      'Function network access request executing in background because the cached response is about to expire.',
    )
    expect(stdout.write).toHaveBeenNthCalledWith(14, expect.stringContaining('Log: '))

    // app_logs[6]
    expect(stdout.write).toHaveBeenNthCalledWith(
      15,
      'Function network access request executing in background because there is no cached response.',
    )
    expect(stdout.write).toHaveBeenNthCalledWith(16, expect.stringContaining('Log: '))

    // app_logs[7]
    expect(stdout.write).toHaveBeenNthCalledWith(17, JSON.stringify(OTHER_PAYLOAD))
    expect(stdout.write).toHaveBeenNthCalledWith(18, expect.stringContaining('Log: '))

    expect(vi.getTimerCount()).toEqual(1)
  })

  test('calls resubscribe callback if a 401 is received', async () => {
    // Given
    const response = {errors: ['Unauthorized'], status: 401}
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValue(response),
    })

    // When/Then
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      developerPlatformClient: mockedDeveloperPlatformClient,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      storeName: 'storeName',
      organizationId: 'organizationId',
      logsDir: TEST_LOGS_DIR,
    })

    expect(MOCKED_RESUBSCRIBE_CALLBACK).toHaveBeenCalled()
  })

  test('displays throttle message, waits, and retries if status is 429', async () => {
    // Given
    const outputWarnSpy = vi.spyOn(output, 'outputWarn')
    const response = {errors: ['error for 429'], status: 429}
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValue(response),
    })

    // When/Then
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      developerPlatformClient: mockedDeveloperPlatformClient,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      storeName: 'storeName',
      organizationId: 'organizationId',
      logsDir: TEST_LOGS_DIR,
    })

    expect(outputWarnSpy).toHaveBeenCalledWith('Request throttled while polling app logs.', stdout)
    expect(vi.getTimerCount()).toEqual(1)
  })

  test('displays error message, waits, and retries if error occurred', async () => {
    // Given
    const outputDebugSpy = vi.spyOn(output, 'outputDebug')
    const outputWarnSpy = vi.spyOn(output, 'outputWarn')

    // An unexpected error response
    const response = {errors: ['errorMessage'], status: 500}
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValue(response),
    })

    // When
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      developerPlatformClient: mockedDeveloperPlatformClient,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      storeName: 'storeName',
      organizationId: 'organizationId',
      logsDir: TEST_LOGS_DIR,
    })

    // Then
    expect(outputWarnSpy).toHaveBeenCalledWith('Error while polling app logs.', stdout)
    expect(vi.getTimerCount()).toEqual(1)
  })

  test('displays error message, waits, and retries if response contained bad JSON', async () => {
    // Given
    const outputDebugSpy = vi.spyOn(output, 'outputDebug')
    const outputWarnSpy = vi.spyOn(output, 'outputWarn')

    const badFunctionLogPayload = 'invalid json'
    const responseDataWithBadJson = {
      app_logs: [
        {
          shop_id: 1,
          api_client_id: 1830457,
          payload: badFunctionLogPayload,
          log_type: FUNCTION_RUN,
          cursor: '2024-05-23T19:17:02.321773Z',
          status: 'success',
          source: SOURCE,
          source_namespace: 'extensions',
          log_timestamp: '2024-05-23T19:17:00.240053Z',
        },
      ],
      status: 200,
      cursor: '2024-05-23T19:17:02.321773Z',
    }
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValue(responseDataWithBadJson),
    })

    // When
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      developerPlatformClient: mockedDeveloperPlatformClient,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      storeName: 'storeName',
      organizationId: 'organizationId',
      logsDir: TEST_LOGS_DIR,
    })

    // When/Then
    await expect(writeAppLogsToFile).not.toHaveBeenCalled
    expect(outputWarnSpy).toHaveBeenCalledWith('Error while polling app logs.', stdout)
    expect(outputWarnSpy).toHaveBeenCalledWith('Retrying in 5 seconds.', stdout)
    expect(outputDebugSpy).toHaveBeenCalledWith(expect.stringContaining('JSON'))
  })
})
