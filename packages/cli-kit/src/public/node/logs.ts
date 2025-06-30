import {joinPath} from './path.js'
import {mkdir, writeFile} from './fs.js'
import {logsFolder} from '../../private/node/constants.js'

export const getLogsDir = (): string => {
  return logsFolder()
}

export const createLogsDir = async (path: string): Promise<void> => {
  await mkdir(joinPath(logsFolder(), path))
}

export const writeLog = async (path: string, logData: string): Promise<void> => {
  await writeFile(joinPath(logsFolder(), path), logData)
}
