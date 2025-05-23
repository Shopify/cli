import {
  createFileReadStream,
  copyFile,
  mkdir,
  fileHasExecutablePermissions,
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
  touchFileSync,
  appendFileSync,
  writeFileSync,
  mkdirSync,
  renameFile,
  removeFileSync,
  rmdir,
  mkTmpDir,
  isDirectory,
  fileSize,
  fileSizeSync,
  unlinkFileSync,
  unlinkFile,
  createFileWriteStream,
  fileLastUpdated,
  fileLastUpdatedTimestamp,
  fileExistsSync,
  pathToFileURL,
  defaultEOL,
  findPathUp,
  matchGlob,
  readdir,
  tempDirectory,
  fileRealPath,
} from './fs.js'
import {joinPath} from './path.js'
import {takeRandomFromArray} from '../common/array.js'
import {describe, expect, test, vi} from 'vitest'
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

describe('touchFileSync', () => {
  test('synchronously creates an empty file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'sync-empty-file')

      touchFileSync(filePath)

      await expect(fileExists(filePath)).resolves.toBe(true)
      const content = await readFile(filePath)
      expect(content).toBe('')
    })
  })
})

describe('appendFileSync', () => {
  test('synchronously appends content to a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'sync-append-file')
      await writeFile(filePath, 'initial')

      appendFileSync(filePath, ' appended')

      const content = await readFile(filePath)
      expect(content).toBe('initial appended')
    })
  })
})

describe('writeFileSync', () => {
  test('synchronously writes content to a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'sync-write-file')
      const content = 'sync written content'

      writeFileSync(filePath, content)

      const readContent = await readFile(filePath)
      expect(readContent).toBe(content)
    })
  })
})

describe('mkdirSync', () => {
  test('synchronously creates a directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const dirPath = joinPath(tmpDir, 'sync-new-dir')

      mkdirSync(dirPath)

      await expect(isDirectory(dirPath)).resolves.toBe(true)
    })
  })

  test('synchronously creates nested directories', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const dirPath = joinPath(tmpDir, 'nested', 'sync-dir')

      mkdirSync(dirPath)

      await expect(isDirectory(dirPath)).resolves.toBe(true)
    })
  })
})

describe('renameFile', () => {
  test('renames a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const oldPath = joinPath(tmpDir, 'old-name.txt')
      const newPath = joinPath(tmpDir, 'new-name.txt')
      const content = 'file content'
      await writeFile(oldPath, content)

      await renameFile(oldPath, newPath)

      await expect(fileExists(oldPath)).resolves.toBe(false)
      await expect(fileExists(newPath)).resolves.toBe(true)
      const readContent = await readFile(newPath)
      expect(readContent).toBe(content)
    })
  })
})

describe('removeFileSync', () => {
  test('synchronously removes a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'file-to-remove-sync')
      await writeFile(filePath, 'content')
      await expect(fileExists(filePath)).resolves.toBe(true)

      removeFileSync(filePath)

      await expect(fileExists(filePath)).resolves.toBe(false)
    })
  })
})

describe('rmdir', () => {
  test('removes a directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const dirPath = joinPath(tmpDir, 'dir-to-remove')
      await mkdir(dirPath)
      await writeFile(joinPath(dirPath, 'file.txt'), 'content')
      await expect(fileExists(dirPath)).resolves.toBe(true)

      await rmdir(dirPath, {force: true})

      await expect(fileExists(dirPath)).resolves.toBe(false)
    })
  })

  test('removes a directory with force option', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const dirPath = joinPath(tmpDir, 'dir-to-force-remove')
      await mkdir(dirPath)
      await writeFile(joinPath(dirPath, 'file.txt'), 'content')

      await rmdir(dirPath, {force: true})

      await expect(fileExists(dirPath)).resolves.toBe(false)
    })
  })
})

describe('mkTmpDir', () => {
  test('creates a temporary directory', async () => {
    const tmpDir = await mkTmpDir()

    await expect(fileExists(tmpDir)).resolves.toBe(true)
    await expect(isDirectory(tmpDir)).resolves.toBe(true)
    expect(tmpDir).toMatch(/tmp-/)
  })
})

describe('isDirectory', () => {
  test('returns true for a directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await expect(isDirectory(tmpDir)).resolves.toBe(true)
    })
  })

  test('returns false for a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      await writeFile(filePath, 'content')

      await expect(isDirectory(filePath)).resolves.toBe(false)
    })
  })
})

describe('fileSize', () => {
  test('returns the size of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      const content = 'hello world'
      await writeFile(filePath, content)

      const size = await fileSize(filePath)

      expect(size).toBe(Buffer.byteLength(content, 'utf8'))
    })
  })
})

describe('fileSizeSync', () => {
  test('synchronously returns the size of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file-sync')
      const content = 'hello world sync'
      await writeFile(filePath, content)

      const size = fileSizeSync(filePath)

      expect(size).toBe(Buffer.byteLength(content, 'utf8'))
    })
  })
})

describe('unlinkFileSync', () => {
  test('synchronously unlinks a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'file-to-unlink-sync')
      await writeFile(filePath, 'content')
      await expect(fileExists(filePath)).resolves.toBe(true)

      unlinkFileSync(filePath)

      await expect(fileExists(filePath)).resolves.toBe(false)
    })
  })
})

describe('unlinkFile', () => {
  test('unlinks a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'file-to-unlink')
      await writeFile(filePath, 'content')
      await expect(fileExists(filePath)).resolves.toBe(true)

      await unlinkFile(filePath)

      await expect(fileExists(filePath)).resolves.toBe(false)
    })
  })
})

describe('createFileWriteStream', () => {
  test('creates a write stream for a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'write-stream-file')
      const content = 'stream content'

      const writeStream = createFileWriteStream(filePath)
      writeStream.write(content)
      writeStream.end()

      // Wait for the stream to finish
      await new Promise((resolve) => writeStream.on('finish', resolve))

      const readContent = await readFile(filePath)
      expect(readContent).toBe(content)
    })
  })
})

describe('fileLastUpdated', () => {
  test('returns the last updated date of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'test-file')
      await writeFile(filePath, 'content')

      const lastUpdated = await fileLastUpdated(filePath)

      expect(lastUpdated).toBeInstanceOf(Date)
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(Date.now())
    })
  })
})

describe('fileLastUpdatedTimestamp', () => {
  test('returns the last updated timestamp of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const beforeTime = Date.now()
      const filePath = joinPath(tmpDir, 'test-file')
      await writeFile(filePath, 'content')

      const timestamp = await fileLastUpdatedTimestamp(filePath)

      expect(typeof timestamp).toBe('number')
      // we add a little buffer, sometimes the time is not perfectly linear
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime - 100)
    })
  })

  test('returns undefined for non-existent file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'non-existent-file')

      const timestamp = await fileLastUpdatedTimestamp(filePath)

      expect(timestamp).toBeUndefined()
    })
  })
})

describe('fileExistsSync', () => {
  test('returns true for existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'existing-file')
      await writeFile(filePath, 'content')

      expect(fileExistsSync(filePath)).toBe(true)
    })
  })

  test('returns false for non-existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'non-existing-file')

      expect(fileExistsSync(filePath)).toBe(false)
    })
  })
})

describe('pathToFileURL', () => {
  test('converts a path to a file URL', () => {
    const path = '/some/path/file.txt'

    const url = pathToFileURL(path)

    expect(url).toBeInstanceOf(URL)
    expect(url.protocol).toBe('file:')
    expect(url.pathname.endsWith(path)).toBe(true)
  })

  test('handles Windows paths', () => {
    const path = 'C:\\Users\\test\\file.txt'

    const url = pathToFileURL(path)

    expect(url).toBeInstanceOf(URL)
    expect(url.protocol).toBe('file:')
  })
})

describe('defaultEOL', () => {
  test('returns the default EOL character', () => {
    vi.mocked(os).EOL = '\n'

    const eol = defaultEOL()

    expect(eol).toBe('\n')
  })

  test('returns CRLF when os.EOL is CRLF', () => {
    vi.mocked(os).EOL = '\r\n'

    const eol = defaultEOL()

    expect(eol).toBe('\r\n')
  })
})

describe('findPathUp', () => {
  test('finds a file up the directory tree', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const nestedDir = joinPath(tmpDir, 'nested', 'dir')
      await mkdir(nestedDir)

      const targetFile = joinPath(tmpDir, 'package.json')
      await writeFile(targetFile, '{}')

      const found = await findPathUp('package.json', {cwd: nestedDir})

      expect(found).toBe(targetFile)
    })
  })

  test('returns undefined when file is not found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const found = await findPathUp('non-existent-file.txt', {cwd: tmpDir})

      expect(found).toBeUndefined()
    })
  })
})

describe('matchGlob', () => {
  test('matches simple patterns', () => {
    expect(matchGlob('file.txt', '*.txt')).toBe(true)
    expect(matchGlob('file.js', '*.txt')).toBe(false)
  })

  test('matches with matchBase option', () => {
    expect(matchGlob('some/deep/path/file.txt', '*.txt', {matchBase: true, noglobstar: false})).toBe(true)
    expect(matchGlob('some/deep/path/file.js', '*.txt', {matchBase: true, noglobstar: false})).toBe(false)
  })

  test('respects noglobstar option', () => {
    expect(matchGlob('a/b/c', 'a/**/c', {matchBase: false, noglobstar: false})).toBe(true)
    expect(matchGlob('a/b/c', 'a/*/c', {matchBase: false, noglobstar: true})).toBe(true)
    expect(matchGlob('a/b/c', 'a/**/c', {matchBase: false, noglobstar: true})).toBe(true)
  })
})

describe('readdir', () => {
  test('lists directory contents', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(joinPath(tmpDir, 'file1.txt'), 'content1')
      await writeFile(joinPath(tmpDir, 'file2.txt'), 'content2')
      await mkdir(joinPath(tmpDir, 'subdir'))

      const contents = await readdir(tmpDir)

      expect(contents).toHaveLength(3)
      expect(contents).toContain('file1.txt')
      expect(contents).toContain('file2.txt')
      expect(contents).toContain('subdir')
    })
  })
})

describe('tempDirectory', () => {
  test('returns a temporary directory path', () => {
    const tmpDir = tempDirectory()

    expect(typeof tmpDir).toBe('string')
    expect(tmpDir.length).toBeGreaterThan(0)
  })
})

describe('fileRealPath', () => {
  test('returns the real path of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'real-file.txt')
      await writeFile(filePath, 'content')

      const realPath = await fileRealPath(filePath)

      expect(typeof realPath).toBe('string')
      expect(realPath).toContain('real-file.txt')
    })
  })
})

describe('readFile with different options', () => {
  test('reads file as buffer when no encoding specified', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'buffer-file.txt')
      const content = 'buffer content'
      await writeFile(filePath, content)

      const result = await readFile(filePath, {})

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe(content)
    })
  })

  test('reads file with custom encoding', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'custom-encoding-file.txt')
      const content = 'custom encoding content'
      await writeFile(filePath, content)

      const result = await readFile(filePath, {encoding: 'utf8'})

      expect(typeof result).toBe('string')
      expect(result).toBe(content)
    })
  })
})

describe('writeFile with custom options', () => {
  test('writes file with custom encoding', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'custom-write-file.txt')
      const content = 'custom write content'

      await writeFile(filePath, content, {encoding: 'utf8'})

      const readContent = await readFile(filePath)
      expect(readContent).toBe(content)
    })
  })

  test('writes buffer content', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'buffer-write-file.txt')
      const content = Buffer.from('buffer content')

      await writeFile(filePath, content)

      const readContent = await readFile(filePath)
      expect(readContent).toBe(content.toString())
    })
  })
})

describe('moveFile with options', () => {
  test('moves file with overwrite option', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const srcPath = joinPath(tmpDir, 'source.txt')
      const destPath = joinPath(tmpDir, 'destination.txt')
      await writeFile(srcPath, 'source content')
      await writeFile(destPath, 'existing content')

      await moveFile(srcPath, destPath, {overwrite: true})

      await expect(fileExists(srcPath)).resolves.toBe(false)
      await expect(fileExists(destPath)).resolves.toBe(true)
      const content = await readFile(destPath)
      expect(content).toBe('source content')
    })
  })
})

describe('createFileReadStream with encoding', () => {
  test('creates a readable stream with encoding', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'encoding-stream-file')
      const content = 'encoding test content'
      await writeFile(filePath, content)

      const stream = createFileReadStream(filePath, {encoding: 'utf8'})
      let data = ''
      stream.on('data', (chunk) => {
        data += chunk
      })

      await new Promise((resolve) => stream.on('end', resolve))
      expect(data).toBe(content)
    })
  })
})
