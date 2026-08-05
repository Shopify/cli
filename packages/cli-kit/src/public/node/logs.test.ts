import {getLogsDir, createLogsDir, writeLog} from './logs.js'
import {inTemporaryDirectory, fileExists, readFile} from './fs.js'
import {joinPath} from './path.js'
import {logsFolder} from '../../private/node/constants.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../private/node/constants.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../private/node/constants.js')>()
  return {
    ...original,
    logsFolder: vi.fn(),
  }
})

describe('getLogsDir', () => {
  test('returns the path to the logs directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(logsFolder).mockReturnValue(tmpDir)
      expect(getLogsDir()).toBe(tmpDir)
    })
  })
})

describe('createLogsDir', () => {
  test('creates a subdirectory in the logs directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(logsFolder).mockReturnValue(tmpDir)
      const subpath = 'custom-subdir'
      await createLogsDir(subpath)
      const expectedPath = joinPath(tmpDir, subpath)
      await expect(fileExists(expectedPath)).resolves.toBe(true)
    })
  })
})

describe('writeLog', () => {
  test('writes log content to the specified file in the logs directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.mocked(logsFolder).mockReturnValue(tmpDir)
      const logFilename = 'app-log.txt'
      const logData = 'Hello world log content'
      await writeLog(logFilename, logData)
      const expectedFilePath = joinPath(tmpDir, logFilename)
      await expect(fileExists(expectedFilePath)).resolves.toBe(true)
      await expect(readFile(expectedFilePath)).resolves.toBe(logData)
    })
  })
})
