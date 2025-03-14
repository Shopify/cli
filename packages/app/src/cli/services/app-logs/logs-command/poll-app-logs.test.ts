import {pollAppLogs} from './poll-app-logs.js'
import {fetchAppLogs} from '../../../utilities/developer-platform-client/partners-client.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/context/fqdn')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../utils.js')

const MOCKED_JWT_TOKEN = 'mockedJwtToken'
const MOCKED_CURSOR = 'mockedCursor'

const RETURNED_CURSOR = '2024-05-23T19:17:02.321773Z'
const RESPONSE_DATA_SUCCESS = {
  app_logs: [
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify({
        input: JSON.stringify({}),
        input_bytes: 123,
        output: JSON.stringify({}),
        output_bytes: 182,
        function_id: 'e57b4d31-2038-49ff-a0a1-1eea532414f7',
        logs: '1\\n2\\n3\\n4\\n',
        fuel_consumed: 512436,
      }),
      log_type: 'function_run',
      cursor: RETURNED_CURSOR,
      status: 'success',
      source: 'my-function',
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
  ],
  cursor: RETURNED_CURSOR,
}

const EMPTY_FILTERS = {status: undefined, sources: undefined}

// Custom mock response with .json method to mock response from poll
const createMockResponse = (data: any, status = 200, statusText = 'OK') => {
  if (status !== 200 || data.errors) {
    return {
      errors: data.errors || [`Error with status ${status}`],
      status,
    }
  }

  return {
    app_logs: data.app_logs || [],
    cursor: data.cursor,
  }
}

describe('pollProcess', () => {
  test('successful poll', async () => {
    // Given
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValueOnce(createMockResponse(RESPONSE_DATA_SUCCESS)),
    })

    // // When
    const result = await pollAppLogs({
      pollOptions: {
        jwtToken: MOCKED_JWT_TOKEN,
        cursor: MOCKED_CURSOR,
        filters: EMPTY_FILTERS,
      },
      developerPlatformClient: mockedDeveloperPlatformClient,
    })

    expect(result).toEqual({
      cursor: RETURNED_CURSOR,
      appLogs: RESPONSE_DATA_SUCCESS.app_logs,
    })
  })

  test('successful poll with filters', async () => {
    // Given
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValueOnce(createMockResponse(RESPONSE_DATA_SUCCESS)),
    })

    // // When
    const result = await pollAppLogs({
      pollOptions: {
        jwtToken: MOCKED_JWT_TOKEN,
        cursor: MOCKED_CURSOR,
        filters: {status: 'failure', sources: ['extensions.my-function', 'extensions.my-other-function']},
      },
      developerPlatformClient: mockedDeveloperPlatformClient,
    })

    expect(result).toEqual({
      cursor: RETURNED_CURSOR,
      appLogs: [],
    })
  })

  test.each([
    [401, 'Unauthorized'],
    [429, 'Rate limit'],
    [500, 'Server Eror'],
  ])('returns errors when response is %s', async (status, statusText) => {
    // Given
    const mockedDeveloperPlatformClient = testDeveloperPlatformClient({
      appLogs: vi.fn().mockResolvedValueOnce(createMockResponse({errors: [statusText]}, status)),
    })

    // When
    const result = await pollAppLogs({
      pollOptions: {
        jwtToken: MOCKED_JWT_TOKEN,
        cursor: MOCKED_CURSOR,
        filters: EMPTY_FILTERS,
      },
      developerPlatformClient: mockedDeveloperPlatformClient,
    })

    // Then
    expect(result).toEqual({
      errors: [{status, message: statusText}],
    })
  })

  test('polling with other error status', async () => {
    // Given
    const status = 422
    const statusText = 'Unprocessable'
    const responseData = {
      errors: [statusText],
    }

    const mockedDeveloperPlatformClient = testDeveloperPlatformClient()
    const mockedFetchAppLogs = vi.fn().mockResolvedValueOnce(createMockResponse(responseData, status, statusText))
    vi.mocked(fetchAppLogs).mockImplementation(mockedFetchAppLogs)

    // When/Then
    await expect(() =>
      pollAppLogs({
        pollOptions: {
          jwtToken: MOCKED_JWT_TOKEN,
          cursor: MOCKED_CURSOR,
          filters: EMPTY_FILTERS,
        },
        developerPlatformClient: mockedDeveloperPlatformClient,
      }),
    ).rejects.toThrowError()
  })
})
