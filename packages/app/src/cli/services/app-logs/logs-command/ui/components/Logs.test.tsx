import {Logs} from './Logs.js'
import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {
  AppLogPayload,
  AppLogPrefix,
  BackgroundExecutionReason,
  FunctionRunLog,
  NetworkAccessRequestExecutedLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  NetworkAccessResponseFromCacheLog,
} from '../../../types.js'
import {testDeveloperPlatformClient} from '../../../../../models/app/app.test-data.js'
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

const USE_POLL_APP_LOGS_ERRORS_RETURN_VALUE = {
  errors: ['Test Error'],
  appLogOutputs: [],
}

const STORE_NAME_BY_ID = new Map()
STORE_NAME_BY_ID.set('1', 'my-store')

const EMPTY_FILTERS = {status: undefined, sources: undefined}

const appLogFunctionRunOutputs = ({
  prefix = {},
  appLog = {},
}: {
  prefix?: Partial<AppLogPrefix>
  appLog?: Partial<AppLogPayload>
} = {}): {appLog: FunctionRunLog; prefix: AppLogPrefix} => {
  const defaultPrefix = {
    functionId: FUNCTION_ID,
    logTimestamp: TIME,
    description: `export "run" executed in 0.5124M instructions`,
    storeName: 'my-store',
    status: STATUS === 'success' ? 'Success' : 'Failure',
    source: SOURCE,
  }

  const defaultAppLog = {
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
    inputQueryVariablesMetafieldValue: '{"key":"value"}',
    inputQueryVariablesMetafieldNamespace: 'inputQueryVariablesMetafieldNamespace',
    inputQueryVariablesMetafieldKey: 'inputQueryVariablesMetafieldKey',
  }

  const resultPrefix = {...defaultPrefix, ...prefix}
  const resultAppLog = {...defaultAppLog, ...appLog}

  return {
    appLog: new FunctionRunLog(resultAppLog),
    prefix: resultPrefix,
  }
}

describe('Logs', () => {
  describe('App Logs', () => {
    test('renders FunctionRunLog correctly with metafield data', async () => {
      const appLogOutput = appLogFunctionRunOutputs()

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [appLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success export \\"run\\" executed in 0.5124M instructions
          test logs

          Input Query Variables:

           Namespace: inputQueryVariablesMetafieldNamespace
           Key: inputQueryVariablesMetafieldKey

           {
             \\"key\\": \\"value\\"
           }

          Input (10 bytes):

           {
             \\"test\\": \\"input\\"
           }

          Output (10 bytes):

           {
             \\"test\\": \\"output\\"
           }"
      `)

      renderInstance.unmount()
    })

    test('renders FunctionRunLog correctly with nil metafield value', async () => {
      const appLogOutput = appLogFunctionRunOutputs({
        appLog: {
          inputQueryVariablesMetafieldValue: null,
        },
      })
      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [appLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
        "2024-06-18 16:02:04.868 my-store my-function Success export \\"run\\" executed in 0.5124M instructions
            test logs

            Input Query Variables:

             Namespace: inputQueryVariablesMetafieldNamespace
             Key: inputQueryVariablesMetafieldKey

             Metafield is not set

            Input (10 bytes):

             {
               \\"test\\": \\"input\\"
             }

            Output (10 bytes):

             {
               \\"test\\": \\"output\\"
             }"
        `)

      renderInstance.unmount()
    })

    test('redners FunctionRunLog without iqv when key and namespace are null', async () => {
      const appLogOutput = appLogFunctionRunOutputs({
        appLog: {
          inputQueryVariablesMetafieldValue: null,
          inputQueryVariablesMetafieldNamespace: null,
          inputQueryVariablesMetafieldKey: null,
        },
      })

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [appLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success export \\"run\\" executed in 0.5124M instructions
          test logs

          Input (10 bytes):

           {
             \\"test\\": \\"input\\"
           }

          Output (10 bytes):

           {
             \\"test\\": \\"output\\"
           }"
      `)

      renderInstance.unmount()
    })
  })

  describe('Network Access', () => {
    test('renders NetworkAccessResponseFromCacheLog correctly', async () => {
      const webhookLogOutput = {
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
          storeName: 'my-store',
          status: 'Success',
          source: SOURCE,
        },
      }

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [webhookLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success network access response from cache
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
          }"
      `)

      renderInstance.unmount()
    })

    test('renders NetworkAccessRequestExecutedLog correctly with success', async () => {
      const webhookLogOutput = {
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
          storeName: 'my-store',
          source: SOURCE,
        },
      }

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [webhookLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success network access request executed in 80 ms
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
          }"
      `)

      renderInstance.unmount()
    })

    test('renders NetworkAccessRequestExecutedLog correctly with failure', async () => {
      const webhookLogOutput = {
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
          storeName: 'my-store',
          status: 'Failure',
          source: SOURCE,
        },
      }

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [webhookLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Failure network access request executed
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
          Error: Timeout Error"
      `)

      renderInstance.unmount()
    })

    test('renders NetworkAccessRequestExecutionInBackgroundLog correctly with NoCachedResponse', async () => {
      const webhookLogOutput = {
        appLog: new NetworkAccessRequestExecutionInBackgroundLog({
          reason: BackgroundExecutionReason.NoCachedResponse,
          httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        }),
        prefix: {
          functionId: FUNCTION_ID,
          logTimestamp: TIME,
          description: 'network access request executing in background',
          storeName: 'my-store',
          status: 'Success',
          source: SOURCE,
        },
      }

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [webhookLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success network access request executing in background
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
          }"
      `)

      renderInstance.unmount()
    })

    test('renders NetworkAccessRequestExecutionInBackgroundLog correctly with CacheAboutToExpire', async () => {
      const webhookLogOutput = {
        appLog: new NetworkAccessRequestExecutionInBackgroundLog({
          reason: BackgroundExecutionReason.CacheAboutToExpire,
          httpRequest: NETWORK_ACCESS_HTTP_REQUEST,
        }),
        prefix: {
          functionId: FUNCTION_ID,
          logTimestamp: TIME,
          description: 'network access request executing in background',
          storeName: 'my-store',
          status: 'Success',
          source: SOURCE,
        },
      }

      const mockedUsePollAppLogs = vi.fn().mockReturnValue({appLogOutputs: [webhookLogOutput], errors: []})
      vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

      const renderInstance = render(
        <Logs
          pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
          resubscribeCallback={vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)}
          storeNameById={new Map()}
          developerPlatformClient={testDeveloperPlatformClient()}
        />,
      )

      const lastFrame = renderInstance.lastFrame()

      expect(unstyled(lastFrame!)).toMatchInlineSnapshot(`
      "2024-06-18 16:02:04.868 my-store my-function Success network access request executing in background
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
  })

  test('handles errors', async () => {
    const mockedUsePollAppLogs = vi.fn().mockReturnValue(USE_POLL_APP_LOGS_ERRORS_RETURN_VALUE)
    vi.mocked(usePollAppLogs).mockImplementation(mockedUsePollAppLogs)

    const mockedResubscribeCallback = vi.fn().mockResolvedValueOnce(MOCKED_JWT_TOKEN)

    const renderInstance = render(
      <Logs
        pollOptions={{jwtToken: MOCKED_JWT_TOKEN, filters: EMPTY_FILTERS, cursor: MOCKED_CURSOR}}
        resubscribeCallback={mockedResubscribeCallback}
        storeNameById={new Map()}
        developerPlatformClient={testDeveloperPlatformClient()}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`"Test Error"`)
    renderInstance.unmount()
  })
})
