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
  const fileName = `${appLog.log_timestamp}_${identifier}.json`
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
