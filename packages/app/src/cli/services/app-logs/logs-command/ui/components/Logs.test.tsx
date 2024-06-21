import {Logs} from './Logs.js'
import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {ONE_MILLION} from '../../../utils.js'
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

const USE_POLL_APP_LOGS_RETURN_VALUE = {
  appLogOutputs: [
    {
      appLog: {
        logs: LOGS,
        input: INPUT,
        inputBytes: INPUT_BYTES,
        output: OUTPUT,
        outputBytes: OUTPUT_BYTES,
        invovationId: 'invocationId',
        functionId: FUNCTION_ID,
        errorMessage: 'errorMessage',
        errorType: 'errorType',
      },
      prefix: {
        functionId: FUNCTION_ID,
        logTimestamp: TIME,
        description: `in ${(FUEL_CONSUMED / ONE_MILLION).toFixed(4)} M instructions`,
        status: STATUS === 'success' ? 'Success' : 'Failure',
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
      "${TIME} ${SOURCE} ${STATUS === 'success' ? 'Success' : 'Failure'} in ${(FUEL_CONSUMED / ONE_MILLION).toFixed(
      4,
    )} M instructions
      test logs
      Input (${INPUT_BYTES} bytes):
      {
        \\"test\\": \\"input\\"
      }
      Output (${OUTPUT_BYTES} bytes):
      {
        \\"test\\": \\"output\\"
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
