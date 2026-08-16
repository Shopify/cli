import {getLogsDir, createLogsDir, writeLog} from './logs.js'
import {inTemporaryDirectory, fileExists, readFile} from './fs.js'
import {joinPath} from './path.js'
import {logsFolder} from '../../private/node/constants.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../private/node/constants.js')

describe('logs', () => {
  test('getLogsDir returns the logs directory', () => {
    // Given
    vi.mocked(logsFolder).mockReturnValue('/tmp/logs')

    // When
    const got = getLogsDir()

    // Then
    expect(got).toBe('/tmp/logs')
  })

  test('createLogsDir creates a directory inside the logs directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(logsFolder).mockReturnValue(tmpDir)
      const subDir = 'test-dir'

      // When
      await createLogsDir(subDir)

      // Then
      const got = await fileExists(joinPath(tmpDir, subDir))
      expect(got).toBe(true)
    })
  })

  test('writeLog writes the log data to a file inside the logs directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(logsFolder).mockReturnValue(tmpDir)
      const logFile = 'test-log.txt'
      const logData = 'test-data'

      // When
      await writeLog(logFile, logData)

      // Then
      const got = await readFile(joinPath(tmpDir, logFile))
      expect(got).toBe(logData)
    })
  })
})
