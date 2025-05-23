import {getLogsDir, createLogsDir, writeLog} from './logs.js'
import {logsFolder} from '../../private/node/constants.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../private/node/constants.js')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/fs')

const mockLogsFolder = vi.mocked(logsFolder)
const mockJoinPath = vi.mocked(joinPath)
const mockMkdir = vi.mocked(mkdir)
const mockWriteFile = vi.mocked(writeFile)

describe('logs', () => {
  describe('getLogsDir', () => {
    test('returns the logs folder path', () => {
      // Given
      const expectedPath = '/path/to/logs'
      mockLogsFolder.mockReturnValue(expectedPath)

      // When
      const result = getLogsDir()

      // Then
      expect(result).toBe(expectedPath)
      expect(mockLogsFolder).toHaveBeenCalledTimes(1)
    })

    test('returns different paths for different environments', () => {
      // Given
      const paths = ['/logs/dev', '/logs/prod', '/logs/test']

      // When/Then
      paths.forEach((path) => {
        mockLogsFolder.mockReturnValue(path)
        expect(getLogsDir()).toBe(path)
      })

      expect(mockLogsFolder).toHaveBeenCalledTimes(paths.length)
    })
  })

  describe('createLogsDir', () => {
    test('creates directory at the correct path', async () => {
      // Given
      const basePath = '/base/logs'
      const subPath = 'app/session'
      const fullPath = '/base/logs/app/session'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await createLogsDir(subPath)

      // Then
      expect(mockLogsFolder).toHaveBeenCalledTimes(1)
      expect(mockJoinPath).toHaveBeenCalledWith(basePath, subPath)
      expect(mockMkdir).toHaveBeenCalledWith(fullPath)
    })

    test('handles nested directory paths', async () => {
      // Given
      const basePath = '/var/logs'
      const nestedPath = 'app/modules/ui/session'
      const fullPath = '/var/logs/app/modules/ui/session'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await createLogsDir(nestedPath)

      // Then
      expect(mockJoinPath).toHaveBeenCalledWith(basePath, nestedPath)
      expect(mockMkdir).toHaveBeenCalledWith(fullPath)
    })

    test('handles empty path', async () => {
      // Given
      const basePath = '/logs'
      const emptyPath = ''
      const fullPath = '/logs/'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await createLogsDir(emptyPath)

      // Then
      expect(mockJoinPath).toHaveBeenCalledWith(basePath, emptyPath)
      expect(mockMkdir).toHaveBeenCalledWith(fullPath)
    })

    test('propagates mkdir errors', async () => {
      // Given
      const error = new Error('Permission denied')
      mockLogsFolder.mockReturnValue('/logs')
      mockJoinPath.mockReturnValue('/logs/test')
      mockMkdir.mockRejectedValue(error)

      // When/Then
      await expect(createLogsDir('test')).rejects.toThrow('Permission denied')
    })
  })

  describe('writeLog', () => {
    test('writes log data to the correct file path', async () => {
      // Given
      const basePath = '/base/logs'
      const filePath = 'app.log'
      const logData = 'This is a log message'
      const fullPath = '/base/logs/app.log'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await writeLog(filePath, logData)

      // Then
      expect(mockLogsFolder).toHaveBeenCalledTimes(1)
      expect(mockJoinPath).toHaveBeenCalledWith(basePath, filePath)
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, logData)
    })

    test('handles nested file paths', async () => {
      // Given
      const basePath = '/var/logs'
      const nestedFilePath = 'app/session/debug.log'
      const logData = 'Debug information'
      const fullPath = '/var/logs/app/session/debug.log'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await writeLog(nestedFilePath, logData)

      // Then
      expect(mockJoinPath).toHaveBeenCalledWith(basePath, nestedFilePath)
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, logData)
    })

    test('handles empty log data', async () => {
      // Given
      const basePath = '/logs'
      const filePath = 'empty.log'
      const emptyData = ''
      const fullPath = '/logs/empty.log'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await writeLog(filePath, emptyData)

      // Then
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, emptyData)
    })

    test('handles multiline log data', async () => {
      // Given
      const basePath = '/logs'
      const filePath = 'multiline.log'
      const multilineData = 'Line 1\nLine 2\nLine 3'
      const fullPath = '/logs/multiline.log'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await writeLog(filePath, multilineData)

      // Then
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, multilineData)
    })

    test('propagates writeFile errors', async () => {
      // Given
      const error = new Error('Disk full')
      mockLogsFolder.mockReturnValue('/logs')
      mockJoinPath.mockReturnValue('/logs/test.log')
      mockWriteFile.mockRejectedValue(error)

      // When/Then
      await expect(writeLog('test.log', 'data')).rejects.toThrow('Disk full')
    })

    test('handles special characters in log data', async () => {
      // Given
      const basePath = '/logs'
      const filePath = 'special.log'
      const specialData = 'Special chars: éñ™ 🚀 \t\n\r'
      const fullPath = '/logs/special.log'

      mockLogsFolder.mockReturnValue(basePath)
      mockJoinPath.mockReturnValue(fullPath)

      // When
      await writeLog(filePath, specialData)

      // Then
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, specialData)
    })
  })
})
