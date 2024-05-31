import {writeAppLogsToFile} from './write-app-logs.js'
import {AppEventData} from './poll-app-logs.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeLog} from '@shopify/cli-kit/node/logs'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/logs')

const APP_LOG: AppEventData = {
  shop_id: 1,
  api_client_id: 2,
  payload: JSON.stringify({someJson: 'someJSOn'}),
  event_type: 'function_run',
  cursor: '2024-05-22T15:06:43.841156Z',
  status: 'success',
  log_timestamp: '2024-05-22T15:06:41.827379Z',
}
const API_KEY = 'apiKey'

describe('writeAppLogsToFile', () => {
  let stdout: any

  beforeEach(() => {
    stdout = {write: vi.fn()}
  })

  test('calls writeLog with the right data', async () => {
    // Given
    const logData = expectedLogDataFromAppEvent(APP_LOG)

    // determine the fileName and path
    const fileName = `${APP_LOG.log_timestamp}`
    const path = joinPath(API_KEY, fileName)

    // When
    await writeAppLogsToFile({appLog: APP_LOG, apiKey: API_KEY, stdout})

    // Then
    expect(writeLog).toHaveBeenCalledWith(expect.stringContaining(path), logData)
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Log: '))
  })

  test('prints and re-throws parsing errors', async () => {
    // Given
    const appLog = {
      ...APP_LOG,
      payload: 'invalid JSON',
    }

    // When/Then
    await expect(writeAppLogsToFile({appLog, apiKey: API_KEY, stdout})).rejects.toThrow()
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error while writing log to file: '))
  })
})

function expectedLogDataFromAppEvent(event: AppEventData): string {
  const data = {
    ...event,
    payload: JSON.parse(event.payload),
  }
  return JSON.stringify(data, null, 2)
}
