import {writeAppLogsToFile} from './write-app-logs.js'
import {AppLogData, AppLogPayload, FunctionRunLog} from '../types.js'
import camelcaseKeys from '../camelcase-keys.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {formatLocalDate} from '@shopify/cli-kit/common/string'

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

const NEW_APP_LOG: AppLogData = {
  shop_id: 1,
  api_client_id: 2,
  payload: JSON.stringify({some_json: 'someJSOn'}),
  log_type: 'new_app_log_type',
  cursor: '2024-05-22T15:06:43.841156Z',
  status: 'success',
  source: 'my-function',
  source_namespace: 'extensions',
  log_timestamp: '2024-05-22T15:06:41.827379Z',
}

const FUNCTION_RUN_PAYLOAD = new FunctionRunLog(camelcaseKeys(JSON.parse(APP_LOG.payload)))
const STORE_NAME = 'storeName'

describe('writeAppLogsToFile', () => {
  let stdout: any

  beforeEach(() => {
    stdout = {write: vi.fn()}
  })

  test('calls writeLog with the FunctionRunLog payload type', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      // determine the fileName
      const fileName = `20240522_150641_827Z_${APP_LOG.source_namespace}_${APP_LOG.source}`

      // When
      const returnedPath = await writeAppLogsToFile({
        appLog: APP_LOG,
        appLogPayload: FUNCTION_RUN_PAYLOAD,
        stdout,
        storeName: STORE_NAME,
        logsDir: tmpDir,
      })

      // Then
      const expectedSaveData = {
        shopId: APP_LOG.shop_id,
        apiClientId: APP_LOG.api_client_id,
        payload: {
          logs: ['Line 1!', ' Line2!'],
        },
        logType: APP_LOG.log_type,
        status: APP_LOG.status,
        source: APP_LOG.source,
        sourceNamespace: APP_LOG.source_namespace,
        logTimestamp: APP_LOG.log_timestamp,
        localTime: formatLocalDate(APP_LOG.log_timestamp),
        storeName: STORE_NAME,
      }
      const expectedLogData = JSON.stringify(expectedSaveData, null, 2)

      const writtenContent = await readFile(returnedPath.fullOutputPath)
      expect(writtenContent).toEqual(expectedLogData)
      expect(returnedPath.fullOutputPath).toEqual(expect.stringContaining(joinPath(tmpDir, fileName)))
    })
  })

  test('calls writeLog with strings when no matching payload type', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      // determine the fileName
      const fileName = `20240522_150641_827Z_${NEW_APP_LOG.source_namespace}_${NEW_APP_LOG.source}`

      // When
      const returnedPath = await writeAppLogsToFile({
        appLog: NEW_APP_LOG,
        appLogPayload: JSON.parse(NEW_APP_LOG.payload),
        stdout,
        storeName: STORE_NAME,
        logsDir: tmpDir,
      })

      // Then
      const expectedLogData = expectedLogDataFromAppEvent(NEW_APP_LOG, JSON.parse(NEW_APP_LOG.payload))
      const writtenContent = await readFile(returnedPath.fullOutputPath)
      expect(writtenContent).toEqual(expectedLogData)
      expect(returnedPath.fullOutputPath).toEqual(expect.stringContaining(joinPath(tmpDir, fileName)))
    })
  })
})

function expectedLogDataFromAppEvent(event: AppLogData, payload: AppLogPayload | any): string {
  const {cursor: _, ...eventWithoutCursor} = event

  const data: any = camelcaseKeys({
    ...eventWithoutCursor,
    payload,
    localTime: formatLocalDate(APP_LOG.log_timestamp),
    storeName: STORE_NAME,
  })

  return JSON.stringify(data, null, 2)
}
