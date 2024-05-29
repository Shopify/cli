import {AppEventData} from './poll-app-logs.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeLog, getLogsDir} from '@shopify/cli-kit/node/logs'

import {Writable} from 'stream'

export const writeAppLogsToFile = async ({
  appLog,
  apiKey,
  stdout,
}: {
  appLog: AppEventData
  apiKey: string
  stdout: Writable
}) => {
  const fileName = `app_logs_${appLog.log_timestamp}.json`
  const path = joinPath(apiKey, fileName)
  const fullOutputPath = joinPath(getLogsDir, path)

  try {
    const toSaveData = {
      ...appLog,
      payload: JSON.parse(appLog.payload),
    }

    const logData = JSON.stringify(toSaveData, null, 2)

    await writeLog(path, logData)
    stdout.write(`Log: ${fullOutputPath}\n`)
  } catch (error) {
    stdout.write(`Error while writing log to file: ${error}\n`)
    throw error
  }
}
