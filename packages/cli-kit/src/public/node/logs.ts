import {logsFolder} from '../../private/node/constants.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'

export const getLogsDir = (): string => {
  return logsFolder()
}

export const createLogsDir = async (path: string): Promise<void> => {
  await mkdir(joinPath(logsFolder(), path))
}

export const writeLog = async (path: string, logData: string): Promise<void> => {
  await writeFile(joinPath(logsFolder(), path), logData)
}
