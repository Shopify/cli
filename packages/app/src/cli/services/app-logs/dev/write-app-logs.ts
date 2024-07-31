import {AppLogData} from '../types.js'
import {LOG_TYPE_FUNCTION_RUN} from '../utils.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeLog, getLogsDir} from '@shopify/cli-kit/node/logs'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import camelcaseKeys from 'camelcase-keys'
import {Writable} from 'stream'

interface AppLogFile {
  fullOutputPath: string
  identifier: string
}

export const writeAppLogsToFile = async ({
  appLog,
  apiKey,
  stdout,
}: {
  appLog: AppLogData
  apiKey: string
  stdout: Writable
}): Promise<AppLogFile> => {
  const identifier = randomUUID().substring(0, 6)

  const formattedTimestamp = formatTimestampToFilename(appLog.log_timestamp)
  const fileName = `${formattedTimestamp}_${appLog.source_namespace}_${appLog.source}_${identifier}.json`
  const path = joinPath(apiKey, fileName)
  const fullOutputPath = joinPath(getLogsDir(), path)

  try {
    const payload = JSON.parse(appLog.payload)

    if (appLog.log_type === LOG_TYPE_FUNCTION_RUN) {
      payload.logs = payload.logs.split('\n').filter(Boolean)
    }

    const toSaveData = camelcaseKeys(
      {
        ...appLog,
        payload,
      },
      {deep: true},
    )

    const logData = JSON.stringify(toSaveData, null, 2)

    await writeLog(path, logData)
    return {
      fullOutputPath,
      identifier,
    }
  } catch (error) {
    stdout.write(`Error while writing log to file: ${error}\n`)
    throw error
  }
}

function formatTimestampToFilename(logTimestamp: string): string {
  const date = new Date(logTimestamp)
  const year = date.getUTCFullYear()
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}Z`
}
