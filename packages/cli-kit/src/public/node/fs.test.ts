import {
  createFileReadStream,
  copyFile,
  mkdir,
  fileHasExecutablePermissions,
  fileHasWritePermissions,
  unixFileIsOwnedByCurrentUser,
  writeFile,
  readFile,
  inTemporaryDirectory,
  fileExists,
  moveFile,
  chmod,
  removeFile,
  stripUpPath,
  touchFile,
  appendFile,
  generateRandomNameForSubdirectory,
  readFileSync,
  glob,
  detectEOL,
  copyDirectoryContents,
} from './fs.js'
import {joinPath} from './path.js'
import {takeRandomFromArray} from '../common/array.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import FastGlob from 'fast-glob'
import * as os from 'os'

vi.mock('../common/array.js')
vi.mock('fast-glob')
vi.mock('os')

describe('inTemporaryDirectory', () => {
  test('ties the lifecycle of the temporary directory to the lifecycle of the callback', async () => {
    // Given
    let gotTmpDir = ''

    await inTemporaryDirectory(async (tmpDir) => {
      gotTmpDir = tmpDir
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'test-content'
      await writeFile(filePath, content)
      await expect(fileExists(filePath)).resolves.toBe(true)
    })

    // Then
    await expect(fileExists(gotTmpDir)).resolves.toBe(false)
  })
})
describe('copy', () => {
  test('copies the file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = joinPath(tmpDir, 'from')
      const to = joinPath(tmpDir, 'to')
      await writeFile(from, content)

      // When
      await copyFile(from, to)

      // Then
      const got = await readFile(to)
      expect(got).toEqual(content)
    })
  })

  test('copies the directory recursively including dot files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = joinPath(tmpDir, 'from')
      const fromChild = joinPath(from, 'child')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(fromChild)
      await writeFile(joinPath(from, 'file'), content)
      await writeFile(joinPath(fromChild, '.dotfile'), content)

      // When
      await copyFile(from, to)

      // Then
      await expect(readFile(joinPath(to, 'file'))).resolves.toEqual(content)
      await expect(readFile(joinPath(to, 'child', '.dotfile'))).resolves.toEqual(content)
    })
  })
})

describe('move', () => {
  test('moves files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = joinPath(tmpDir, 'from')
      const to = joinPath(tmpDir, 'to')
      await writeFile(from, content)

      // When
      await moveFile(from, to)

      // Then
      const got = await readFile(to)
      expect(got).toEqual(content)
    })
  })
})

describe('exists', () => {
  test('returns true when the file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = joinPath(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      const got = await fileExists(filePath)

      // Then
      expect(got).toEqual(true)
    })
  })

  test('returns false when the file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'from')

      // When
      const got = await fileExists(filePath)

      // Then
      expect(got).toEqual(false)
    })
  })
})

describe('chmod', () => {
  test('changes the permissions of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = joinPath(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      await chmod(filePath, '777')

      // Then
      await expect(fileHasExecutablePermissions(filePath)).resolves.toEqual(true)
    })
  })
})

describe('remove', () => {
  test('removes a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = joinPath(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      await removeFile(filePath)

      // Then
      await expect(fileExists(filePath)).resolves.toEqual(false)
    })
  })
})

describe('stripUp', () => {
  test('strips the given amount of leading directories', async () => {
    // Given
    const filePath = 'a/b/c/d/e'

    // When
    const newFilePath1 = stripUpPath(filePath, 1)
    const newFilePath2 = stripUpPath(filePath, 2)
    const newFilePath3 = stripUpPath(filePath, 3)

    // Then
    await expect(newFilePath1).toEqual('b/c/d/e')
    await expect(newFilePath2).toEqual('c/d/e')
    await expect(newFilePath3).toEqual('d/e')
  })
})

describe('appendFile', () => {
  test('it appends content to an existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'test-content'
      await touchFile(filePath)
      await appendFile(filePath, content)
      await expect(readFile(filePath)).resolves.toContain(content)
    })
  })
})

describe('makeDirectoryWithRandomName', () => {
  test('rerolls the name if a directory exists with the same name', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(takeRandomFromArray).mockReturnValueOnce('taken')
      vi.mocked(takeRandomFromArray).mockReturnValueOnce('directory')
      vi.mocked(takeRandomFromArray).mockReturnValueOnce('free')
      vi.mocked(takeRandomFromArray).mockReturnValueOnce('directory')

      const content = 'test'
      const filePath = joinPath(tmpDir, 'taken-directory-app')
      await writeFile(filePath, content)

      // When
      const got = await generateRandomNameForSubdirectory({suffix: 'app', directory: tmpDir})

      // Then
      expect(got).toEqual('free-directory-app')
      expect(takeRandomFromArray).toHaveBeenCalledTimes(4)
    })
  })
})

describe('readFileSync', () => {
  test('synchronously reads content of file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'test-content'
      await touchFile(filePath)
      await appendFile(filePath, content)
      await expect(readFileSync(filePath).toString()).toContain(content)
    })
  })
})

describe('createFileReadStream', () => {
  test('creates a readable stream for a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'test-content'
      await touchFile(filePath)
      await appendFile(filePath, content)
      const stream = createFileReadStream(filePath)
      let data = ''
      stream.on('data', (chunk) => {
        data += chunk as string
      })
      stream.on('end', () => {
        expect(data).toBe(content)
      })
    })
  })

  test('creates a readable stream for a chunk of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'test-content'
      await touchFile(filePath)
      await appendFile(filePath, content)

      const stream = createFileReadStream(filePath, {start: 1, end: 7})
      let data = ''
      stream.on('data', (chunk) => {
        data += chunk as string
      })
      stream.on('end', () => {
        expect(data).toBe('est-con')
      })
    })
  })
})

describe('glob', () => {
  test('calls fastGlob with dot:true if no dot option is passed', async () => {
    // When
    await glob('pattern')

    // Then
    expect(FastGlob).toBeCalledWith('pattern', {dot: true})
  })

  test('calls fastGlob with dot option if passed', async () => {
    // When
    await glob('pattern', {dot: false})

    // Then
    expect(FastGlob).toBeCalledWith('pattern', {dot: false})
  })
})

describe('detectEOL', () => {
  test('detects the EOL of a file', async () => {
    // Given
    const fileContent = 'test\ncontent'

    // When
    const eol = detectEOL(fileContent)

    // Then
    expect(eol).toEqual('\n')
  })

  test('detects the EOL of a file with CRLF', async () => {
    // Given
    const fileContent = 'test\r\ncontent'

    // When
    const eol = detectEOL(fileContent)

    // Then
    expect(eol).toEqual('\r\n')
  })

  test('returns the default EOL if no EOL is found', async () => {
    // Given
    const fileContent = 'testcontent'
    vi.mocked(os).EOL = '\n'

    // When
    const eol = detectEOL(fileContent)

    // Then
    expect(eol).toEqual('\n')
  })
})

describe('copyDirectoryContents', () => {
  beforeEach(() => {
    // restore fast-glob to its original implementation for the tests
    vi.doMock('fast-glob', async () => {
      return vi.importActual('fast-glob')
    })
  })

  test('copies the contents of source directory to destination directory', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'src')
      const destDir = joinPath(tmpDir, 'dest')
      await mkdir(srcDir)
      await mkdir(destDir)
      await writeFile(joinPath(srcDir, 'file'), 'test')
      await copyDirectoryContents(srcDir, destDir)

      // Then
      await expect(readFile(joinPath(destDir, 'file'))).resolves.toEqual('test')
    })
  })

  test('copies the contents of source directory to another directory when destination directory does not exist', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'src')
      const destDir = joinPath(tmpDir, 'dest')
      await mkdir(srcDir)
      await writeFile(joinPath(srcDir, 'file'), 'test')
      await copyDirectoryContents(srcDir, destDir)

      // Then
      await expect(readFile(joinPath(destDir, 'file'))).resolves.toEqual('test')
    })
  })

  test('copies the nested contents of source directory to destination directory', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'src')
      const destDir = joinPath(tmpDir, 'dest')
      await mkdir(srcDir)
      await mkdir(destDir)
      await mkdir(joinPath(srcDir, 'nested'))
      await writeFile(joinPath(srcDir, 'nested', 'file'), 'test')
      await copyDirectoryContents(srcDir, destDir)

      // Then
      await expect(readFile(joinPath(destDir, 'nested', 'file'))).resolves.toEqual('test')
    })
  })

  test('throws an error when the source directory does not exist', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'src')
      const destDir = joinPath(tmpDir, 'dest')

      // When
      await expect(copyDirectoryContents(srcDir, destDir)).rejects.toThrow(`Source directory ${srcDir} does not exist`)
    })
  })
})

describe('fileHasWritePermissions', () => {
  test('returns true when file has write permissions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'writable-file.txt')
      await writeFile(filePath, 'test content')

      // When
      const result = await fileHasWritePermissions(filePath)

      // Then
      expect(result).toBe(true)
    })
  })

  test('returns false when file does not have write permissions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'readonly-file.txt')
      await writeFile(filePath, 'test content')
      // Read-only
      await chmod(filePath, 0o444)

      // When
      const result = await fileHasWritePermissions(filePath)

      // Then
      expect(result).toBe(false)
    })
  })

  test('returns false when file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'nonexistent-file.txt')

      // When
      const result = await fileHasWritePermissions(filePath)

      // Then
      expect(result).toBe(false)
    })
  })

  test('returns true when directory has write permissions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      const result = await fileHasWritePermissions(tmpDir)

      // Then
      expect(result).toBe(true)
    })
  })
})

describe('unixFileIsOwnedByCurrentUser', () => {
  test.skipIf(process.platform === 'win32')('returns true when file is owned by current user', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'my-file.txt')
      await writeFile(filePath, 'test content')

      // When
      const result = await unixFileIsOwnedByCurrentUser(filePath)

      // Then
      expect(result).toBe(true)
    })
  })

  test.skipIf(process.platform === 'win32')('returns false when file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'nonexistent-file.txt')

      // When
      const result = await unixFileIsOwnedByCurrentUser(filePath)

      // Then
      expect(result).toBe(false)
    })
  })

  test.runIf(process.platform === 'win32')('returns undefined on Windows', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, 'my-file.txt')
      await writeFile(filePath, 'test content')

      // When
      const result = await unixFileIsOwnedByCurrentUser(filePath)

      // Then
      expect(result).toBe(undefined)
    })
  })
})
