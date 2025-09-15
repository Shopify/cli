import {AppLogData} from '../types.js'
import {toFormattedAppLogJson} from '../utils.js'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {Writable} from 'stream'

interface AppLogFile {
  fullOutputPath: string
  identifier: string
}

export const writeAppLogsToFile = async ({
  appLog,
  appLogPayload,
  apiKey,
  stdout,
  storeName,
  appDirectory,
}: {
  appLog: AppLogData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appLogPayload: any
  apiKey: string
  stdout: Writable
  storeName: string
  appDirectory?: string
}): Promise<AppLogFile> => {
  const identifier = randomUUID().substring(0, 6)

  const formattedTimestamp = formatTimestampToFilename(appLog.log_timestamp)
  const fileName = `${formattedTimestamp}_${appLog.source_namespace}_${appLog.source}_${identifier}.json`
  const logContent = toFormattedAppLogJson({appLog, appLogPayload, prettyPrint: true, storeName})

  // Determine the full output path based on whether we have an app directory
  let fullOutputPath: string
  if (appDirectory) {
    // Write to app's .shopify/logs directory
    fullOutputPath = joinPath(appDirectory, '.shopify', 'logs', apiKey, fileName)
  } else {
    // Fall back to system logs directory
    fullOutputPath = joinPath(getLogsDir(), apiKey, fileName)
  }

  try {
    // Ensure parent directory exists and write the file
    await mkdir(dirname(fullOutputPath))
    await writeFile(fullOutputPath, logContent)

    return {
      fullOutputPath,
      identifier,
    }
  } catch (error) {
    stdout.write(`Error while writing log to file: ${error as string}\n`)
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
