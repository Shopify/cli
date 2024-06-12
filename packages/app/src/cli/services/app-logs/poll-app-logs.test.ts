import {pollAppLogs} from './poll-app-logs.js'
import {writeAppLogsToFile} from './write-app-logs.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import * as components from '@shopify/cli-kit/node/ui/components'
import {outputDebug} from '@shopify/cli-kit/node/output'

const JWT_TOKEN = 'jwtToken'
const API_KEY = 'apiKey'

vi.mock('./write-app-logs.js')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/output')

const FQDN = await partnersFqdn()
const LOGS = '1\\n2\\n3\\n4\\n'
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
}
const OTHER_PAYLOAD = {some: 'arbitrary payload'}
const RETURNED_CURSOR = '2024-05-23T19:17:02.321773Z'
const RESPONSE_DATA = {
  app_logs: [
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(FUNCTION_PAYLOAD),
      event_type: 'function_run',
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
      event_type: 'some arbitrary event type',
      cursor: '2024-05-23T19:17:02.321773Z',
      status: 'failure',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
  ],
  cursor: RETURNED_CURSOR,
}
const MOCKED_RESUBSCRIBE_CALLBACK = vi.fn()
const MOCKED_ON_FUNCTION_RUN_CALLBACK = vi.fn()
const MOCKED_ON_ERROR_CALLBACK = vi.fn()

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

    // Given
    vi.mocked(writeAppLogsToFile)

    vi.spyOn(components, 'useConcurrentOutputContext')

    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(RESPONSE_DATA))
      .mockResolvedValueOnce(Response.json(RESPONSE_DATA))
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      apiKey: API_KEY,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      onFunctionRunCallback: MOCKED_ON_FUNCTION_RUN_CALLBACK,
      onErrorCallback: MOCKED_ON_ERROR_CALLBACK,
    })
    await vi.advanceTimersToNextTimerAsync()

    // Then
    expect(fetch).toHaveBeenCalledWith(firstUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
    })

    expect(fetch).toHaveBeenCalledWith(secondUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
    })

    expect(MOCKED_ON_FUNCTION_RUN_CALLBACK).toHaveBeenCalled()

    expect(vi.getTimerCount()).toEqual(1)
  })

  test('calls resubscribe callback if a 401 is received', async () => {
    // Given
    const url = `https://${FQDN}/app_logs/poll`

    const response = new Response('errorMessage', {status: 401})
    const mockedFetch = vi.fn().mockResolvedValueOnce(response)
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When/Then
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      apiKey: API_KEY,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      onFunctionRunCallback: MOCKED_ON_FUNCTION_RUN_CALLBACK,
      onErrorCallback: MOCKED_ON_ERROR_CALLBACK,
    })

    expect(MOCKED_RESUBSCRIBE_CALLBACK).toHaveBeenCalled()
  })

  test('displays error, waits, and retries if status is 429 or >500', async () => {
    // Given
    const url = `https://${FQDN}/app_logs/poll`

    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('error for 429', {status: 429}))
      .mockResolvedValueOnce(new Response('error for 500', {status: 500}))
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When/Then
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      apiKey: API_KEY,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      onFunctionRunCallback: MOCKED_ON_FUNCTION_RUN_CALLBACK,
      onErrorCallback: MOCKED_ON_ERROR_CALLBACK,
    })
    await vi.advanceTimersToNextTimerAsync()

    expect(outputDebug).toHaveBeenCalledWith('error for 429')
    expect(outputDebug).toHaveBeenCalledWith('error for 500')
    expect(vi.getTimerCount()).toEqual(1)
  })

  test('stops polling when unexpected error occurs instead of throwing ', async () => {
    // Given
    const url = `https://${FQDN}/app_logs/poll`

    // An unexpected error response
    const response = new Response('errorMessage', {status: 422})
    const mockedFetch = vi.fn().mockResolvedValueOnce(response)
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken: JWT_TOKEN},
      apiKey: API_KEY,
      resubscribeCallback: MOCKED_RESUBSCRIBE_CALLBACK,
      onFunctionRunCallback: MOCKED_ON_FUNCTION_RUN_CALLBACK,
      onErrorCallback: MOCKED_ON_ERROR_CALLBACK,
    })

    // Then
    expect(fetch).toHaveBeenCalledWith(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
    })
    expect(MOCKED_ON_ERROR_CALLBACK).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalledWith(expect.stringContaining('errorMessage'))
    expect(vi.getTimerCount()).toEqual(0)
  })
})
