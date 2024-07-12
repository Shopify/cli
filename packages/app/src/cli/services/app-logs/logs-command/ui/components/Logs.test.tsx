import {Logs} from './Logs.js'
import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {
  BackgroundExecutionReason,
  FunctionRunLog,
  NetworkAccessRequestExecutedLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  NetworkAccessResponseFromCacheLog,
} from '../../../types.js'
import {describe, test, vi, expect} from 'vitest'
import {render} from '@shopify/cli-kit/node/testing/ui'
import React from 'react'
import {unstyled} from '@shopify/cli-kit/node/output'

vi.mock('./hooks/usePollAppLogs.js')

const MOCKED_JWT_TOKEN = 'mockedJwtToken'
const MOCKED_CURSOR = 'mockedCursor'
const FUNCTION_ID = 'e57b4d31-2038-49ff-a0a1-1eea532414f7'
const FUEL_CONSUMED = 512436
const TIME = '2024-06-18 16:02:04.868'

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

const USE_POLL_APP_LOGS_RETURN_VALUE = {
  appLogOutputs: [
    {
      appLog: new FunctionRunLog({
        export: 'run',
        input: INPUT,
        inputBytes: INPUT_BYTES,
        output: OUTPUT,
        outputBytes: OUTPUT_BYTES,
        logs: LOGS,
        functionId: FUNCTION_ID,
        fuelConsumed: FUEL_CONSUMED,
        errorMessage: 'errorMessage',
        errorType: 'errorType',
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: `export "run" executed in 0.5124 M instructions`,
        status: STATUS === 'success' ? 'Success' : 'Failure',
        source: SOURCE,
      },
    },
    {
      appLog: new NetworkAccessResponseFromCacheLog({
        cacheEntryEpochMs: 1683904621000,
        cacheTtlMs: 300000,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: NETWORK_ACCESS_HTTP_RESPONSE,
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: 'network access response from cache',
        status: 'Success',
        source: SOURCE,
      },
    },
    {
      appLog: new NetworkAccessRequestExecutedLog({
        attempt: 1,
        connectTimeMs: 40,
        writeReadTimeMs: 40,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: NETWORK_ACCESS_HTTP_RESPONSE,
        error: null,
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: 'network access request executed in 80 ms',
        status: 'Success',
        source: SOURCE,
      },
    },
    {
      appLog: new NetworkAccessRequestExecutedLog({
        attempt: 1,
        connectTimeMs: null,
        writeReadTimeMs: null,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        httpResponse: null,
        error: 'Timeout Error',
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: 'network access request executed',
        status: 'Failure',
        source: SOURCE,
      },
    },
    {
      appLog: new NetworkAccessRequestExecutionInBackgroundLog({
        reason: BackgroundExecutionReason.NoCachedResponse,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: 'network access request executing in background',
        status: 'Success',
        source: SOURCE,
      },
    },
    {
      appLog: new NetworkAccessRequestExecutionInBackgroundLog({
        reason: BackgroundExecutionReason.CacheAboutToExpire,
        httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
      }),
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: 'network access request executing in background',
        status: 'Success',
        source: SOURCE,
      },
    },
  ],
  errors: [],
}

const USE_POLL_APP_LOGS_ERRORS_RETURN_VALUE = {
  errors: ['Test Error'],
  appLogOutputs: [],
}

const EMPTY_FILTERS = {status: undefined, source: undefined}

describe('Logs', () => {
  test('renders prefix and applogs', async () => {
    // Given
    const mockedUsePollAppLogs = vi.fn().mockReturnValue(USE_POLL_APP_LOGS_RETURN_VALUE)
    vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)
    // When
    const renderInstance = render(
      <Logs
        pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
        resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
      />,
    )

    // Then
    const lastFrame = renderInstance.lastFrame()

    expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
    "2024-06-18 16:02:04.868 my-function Success export \\"run\\" executed in 0.5124 M instructions
    test logs
    Input (10 bytes):
    {
      \\"test\\": \\"input\\"
    }
    Output (10 bytes):
    {
      \\"test\\": \\"output\\"
    }
    2024-06-18 16:02:04.868 my-function Success network access response from cache
    Cache write time: 2023-05-12T15:17:01.000Z
    Cache TTL: 300 s
    HTTP request:
    {
      \\"url\\": \\"https://api.example.com/hello\\",
      \\"method\\": \\"GET\\",
      \\"headers\\": {},
      \\"body\\": null,
      \\"policy\\": {
        \\"read_timeout_ms\\": 500
      }
    }
    HTTP response:
    {
      \\"status\\": 200,
      \\"body\\": \\"Success\\",
      \\"headers\\": {
        \\"header1\\": \\"value1\\"
      }
    }
    2024-06-18 16:02:04.868 my-function Success network access request executed in 80 ms
    Attempt: 1
    Connect time: 40 ms
    Write read time: 40 ms
    HTTP request:
    {
      \\"url\\": \\"https://api.example.com/hello\\",
      \\"method\\": \\"GET\\",
      \\"headers\\": {},
      \\"body\\": null,
      \\"policy\\": {
        \\"read_timeout_ms\\": 500
      }
    }
    HTTP response:
    {
      \\"status\\": 200,
      \\"body\\": \\"Success\\",
      \\"headers\\": {
        \\"header1\\": \\"value1\\"
      }
    }
    2024-06-18 16:02:04.868 my-function Failure network access request executed
    Attempt: 1
    HTTP request:
    {
      \\"url\\": \\"https://api.example.com/hello\\",
      \\"method\\": \\"GET\\",
      \\"headers\\": {},
      \\"body\\": null,
      \\"policy\\": {
        \\"read_timeout_ms\\": 500
      }
    }
    Error: Timeout Error
    2024-06-18 16:02:04.868 my-function Success network access request executing in background
    Reason: No cached response available
    HTTP request:
    {
      \\"url\\": \\"https://api.example.com/hello\\",
      \\"method\\": \\"GET\\",
      \\"headers\\": {},
      \\"body\\": null,
      \\"policy\\": {
        \\"read_timeout_ms\\": 500
      }
    }
    2024-06-18 16:02:04.868 my-function Success network access request executing in background
    Reason: Cache is about to expire
    HTTP request:
    {
      \\"url\\": \\"https://api.example.com/hello\\",
      \\"method\\": \\"GET\\",
      \\"headers\\": {},
      \\"body\\": null,
      \\"policy\\": {
        \\"read_timeout_ms\\": 500
      }
    }"
    `)

    renderInstance.unmount()
  })

  test('handles errors', async () => {
    const mockedUsePollAppLogs = vi.fn().mockReturnValue(USE_POLL_APP_LOGS_ERRORS_RETURN_VALUE)
    vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

    const mockedResubscribeCallback = vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)

    const renderInstance = render(
      <Logs
        pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
        resubscribeCallback={mockedResubscribeCallback}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`"Test Error"`)
    renderInstance.unmount()
  })
})
