import {AppEventData} from './poll-app-logs.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeLog, getLogsDir} from '@shopify/cli-kit/node/logs'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
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
  const identifier = randomUUID().substring(0, 6)
  const formattedTimestamp = formatTimestampToFilename(appLog.log_timestamp)
  const fileName = `${formattedTimestamp}_${identifier}.json`
  const path = joinPath(apiKey, fileName)
  const fullOutputPath = joinPath(getLogsDir(), path)

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

function formatTimestampToFilename(timestamp: string): string {
  // 2024-05-22T15:06:41.827379Z
  const year = timestamp.substring(0, 10).replace(/-/g, '')
  const time = timestamp.substring(11, 19).replace(/:/g, '')
  const microseconds = timestamp.substring(20, 26)
  const timezone = timestamp.substring(26)
  return `${year}_${time}_${microseconds}${timezone}`
}
