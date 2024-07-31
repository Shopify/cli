import {writeAppLogsToFile} from './write-app-logs.js'
import {AppLogData} from '../types.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeLog} from '@shopify/cli-kit/node/logs'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import camelcaseKeys from 'camelcase-keys'

vi.mock('@shopify/cli-kit/node/logs')

const APP_LOG: AppLogData = {
  shop_id: 1,
  api_client_id: 2,
  payload: JSON.stringify({someJson: 'someJSOn', logs: 'Line 1!\n Line2!\n'}),
  log_type: 'function_run',
  cursor: '2024-05-22T15:06:43.841156Z',
  status: 'success',
  source: 'my-function',
  source_namespace: 'extensions',
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
    // determine the fileName and path
    const fileName = `20240522_150641_827Z_${APP_LOG.source_namespace}_${APP_LOG.source}`
    const path = joinPath(API_KEY, fileName)

    // When
    const returnedPath = await writeAppLogsToFile({appLog: APP_LOG, apiKey: API_KEY, stdout})

    // Then
    expect(returnedPath.fullOutputPath.startsWith(path)).toBe(true)
    expect(writeLog).toHaveBeenCalledWith(expect.stringContaining(path), expectedLogDataFromAppEvent(APP_LOG))
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

function expectedLogDataFromAppEvent(event: AppLogData): string {
  const payload = JSON.parse(event.payload)

  if (event.log_type === 'function_run') {
    payload.logs = payload.logs.split('\n').filter(Boolean)
  }
  const data = camelcaseKeys(
    {
      ...event,
      payload,
    },
    {deep: true},
  )
  return JSON.stringify(data, null, 2)
}
