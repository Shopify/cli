import {inTemporaryDirectory} from './file.js'
import {isUnitTest} from './environment/local.js'
import {closeLogging, initiateLogging, LinesTruncatorTransformer} from './log.js'
import {generateRandomUUID} from './id.js'
import {join} from './path.js'
import fs from 'fs-extra'
import {beforeAll, describe, expect, it, vi} from 'vitest'
import {appendFileSync} from 'fs'
import {EOL} from 'os'
import {randomBytes} from 'crypto'

const MB_1 = 1024 * 1024
const KB_256 = 0.256 * MB_1
const MB_2 = 2 * MB_1
const MB_5 = 5 * MB_1
const MB_7 = 7 * MB_1

beforeAll(() => {
  vi.mock('./id')
  vi.mock('./environment/local', async () => {
    return {
      isUnitTest: vi.fn(),
      isVerbose: vi.fn(() => false),
    }
  })
})

describe('initiateLogging', () => {
  it('when unit testing should not initiate log file', async () => {
    // Given
    vi.mocked(isUnitTest).mockReturnValue(true)

    // When
    await initiateLogging()

    // Then
    expect(generateRandomUUID).not.toBeCalled()
  })

  it('when log file is not big enough no truncation is executed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(isUnitTest).mockReturnValue(false)
      vi.mocked(generateRandomUUID).mockReturnValue('random-uuid')
      const logPath = join(tmpDir, 'shopify.cli.log')
      createLogFile(logPath, KB_256, MB_2)
      const fileSize = fileSizeSync(logPath)

      // When
      await initiateLogging({logDir: tmpDir, override: true})
      closeLogging()

      // Then
      expect(fileSize).toEqual(fileSizeSync(logPath))
    })
  })

  it('when log file is big enough it should be truncated', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(isUnitTest).mockReturnValue(false)
      vi.mocked(generateRandomUUID).mockReturnValue('random-uuid')
      const logPath = join(tmpDir, 'shopify.cli.log')
      createLogFile(logPath, KB_256, MB_7)
      const originalLogFileSize = fileSizeSync(logPath)

      // When
      await initiateLogging({logDir: tmpDir, override: true})
      closeLogging()

      // Then
      const finalLogFileSize = fileSizeSync(logPath)
      expect(originalLogFileSize).toBeGreaterThan(finalLogFileSize)
      expect(finalLogFileSize).toBeLessThan(MB_5)
    })
  })
})

describe('LinesTruncatorTransformer', () => {
  it('when one chunk not finished with breakline should return all lines correctly', async () => {
    // Given
    const transformer = new LinesTruncatorTransformer({fileSize: 0, maxFileSize: 128})
    const chunk1 = `chunk1`
    const chunk2 = `chunk21${EOL}chunk22`

    // When
    transformer._transform(Buffer.from(chunk1), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk2), 'utf8', () => {})

    // Then
    expect(transformer.linesToRetain.length).toEqual(2)
    expect(transformer.linesToRetain[0]).toEqual('chunk1chunk21')
    expect(transformer.linesToRetain[1]).toEqual('chunk22')
  })

  it('when all chunks finished with breakline should return all lines correctly', async () => {
    // Given
    const transformer = new LinesTruncatorTransformer({fileSize: 0, maxFileSize: 128})
    const chunk1 = `chunk1${EOL}`
    const chunk2 = `chunk21${EOL}chunk22`

    // When
    transformer._transform(Buffer.from(chunk1), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk2), 'utf8', () => {})

    // Then
    expect(transformer.linesToRetain.length).toEqual(3)
    expect(transformer.linesToRetain[0]).toEqual('chunk1')
    expect(transformer.linesToRetain[1]).toEqual('chunk21')
    expect(transformer.linesToRetain[2]).toEqual('chunk22')
  })

  it('when all chunks not finished with breakline should return one lines correctly', async () => {
    // Given
    const transformer = new LinesTruncatorTransformer({fileSize: 0, maxFileSize: 128})
    const chunk1 = 'chunk1'
    const chunk2 = 'chunk2'
    const chunk3 = 'chunk3'

    // When
    transformer._transform(Buffer.from(chunk1), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk2), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk3), 'utf8', () => {})

    // Then
    expect(transformer.linesToRetain.length).toEqual(1)
    expect(transformer.linesToRetain[0]).toEqual('chunk1chunk2chunk3')
  })

  it('when size of chunks are bigger than then max size should return less lines', async () => {
    // Given
    const transformer = new LinesTruncatorTransformer({fileSize: 0, maxFileSize: 12})
    const chunk1 = `chunk1${EOL}`
    const chunk2 = `chunk2${EOL}`
    const chunk3 = `chunk3${EOL}`

    // When
    transformer._transform(Buffer.from(chunk1), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk2), 'utf8', () => {})
    transformer._transform(Buffer.from(chunk3), 'utf8', () => {})

    // Then
    expect(transformer.linesToRetain.length).toEqual(2)
    expect(transformer.linesToRetain[0]).toEqual('chunk2')
    expect(transformer.linesToRetain[1]).toEqual('chunk3')
  })

  it('when size of the file is bigger than max file size to truncate all the content is dropped', async () => {
    // Given
    const transformer = new LinesTruncatorTransformer({fileSize: 128, maxFileSize: 128, maxFileSizeToTruncate: 0})
    const chunk1 = `chunk1${EOL}`

    // When
    transformer._transform(Buffer.from(chunk1), 'utf8', () => {})

    // Then
    expect(transformer.linesToRetain.length).toEqual(0)
  })
})

function createLogFile(logPath: string, lineSize: number, totalSize: number) {
  fs.ensureFileSync(logPath)
  while (fileSizeSync(logPath) < totalSize) {
    appendFileSync(logPath, generateRandomString(lineSize / 2).concat(EOL))
  }
}

function generateRandomString(size: number) {
  return randomBytes(size).toString('hex')
}

function fileSizeSync(path: string): number {
  return fs.statSync(path).size
}
