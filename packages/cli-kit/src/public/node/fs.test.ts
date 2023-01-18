import {
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
  fileContentPrettyFormat,
  touchFile,
  appendFile,
  generateRandomNameForSubdirectory,
} from './fs.js'
import {join} from '../../path.js'
import {takeRandomFromArray} from '../common/array.js'
import {beforeAll, describe, expect, it, test, vi} from 'vitest'

beforeAll(() => {
  vi.mock('../common/array.js')
})

describe('inTemporaryDirectory', () => {
  it('ties the lifecycle of the temporary directory to the lifecycle of the callback', async () => {
    // Given
    let gotTmpDir = ''

    await inTemporaryDirectory(async (tmpDir) => {
      gotTmpDir = tmpDir
      const filePath = join(tmpDir, 'test-file')
      const content = 'test-content'
      await writeFile(filePath, content)
      await expect(fileExists(filePath)).resolves.toBe(true)
    })

    // Then
    await expect(fileExists(gotTmpDir)).resolves.toBe(false)
  })
})
describe('copy', () => {
  it('copies the file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const to = join(tmpDir, 'to')
      await writeFile(from, content)

      // When
      await copyFile(from, to)

      // Then
      const got = await readFile(to)
      expect(got).toEqual(content)
    })
  })

  it('copies the directory recursively including dot files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const fromChild = join(from, 'child')
      const to = join(tmpDir, 'to')
      await mkdir(from)
      await mkdir(fromChild)
      await writeFile(join(from, 'file'), content)
      await writeFile(join(fromChild, '.dotfile'), content)

      // When
      await copyFile(from, to)

      // Then
      await expect(readFile(join(to, 'file'))).resolves.toEqual(content)
      await expect(readFile(join(to, 'child', '.dotfile'))).resolves.toEqual(content)
    })
  })
})

describe('move', () => {
  it('moves files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const to = join(tmpDir, 'to')
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
  it('returns true when the file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      const got = await fileExists(filePath)

      // Then
      expect(got).toEqual(true)
    })
  })

  it('returns false when the file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = join(tmpDir, 'from')

      // When
      const got = await fileExists(filePath)

      // Then
      expect(got).toEqual(false)
    })
  })
})

describe('chmod', () => {
  it('changes the permissions of a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      await chmod(filePath, '777')

      // Then
      await expect(fileHasExecutablePermissions(filePath)).resolves.toEqual(true)
    })
  })
})

describe('remove', () => {
  it('removes a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await writeFile(filePath, content)

      // When
      await removeFile(filePath)

      // Then
      await expect(fileExists(filePath)).resolves.toEqual(false)
    })
  })
})

describe('stripUp', () => {
  it('strips the given amount of leading directories', async () => {
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

describe('format', () => {
  it('formats JavaScript file content', async () => {
    // Given
    const unformatedContent = 'const foo = "bar"'

    // When
    const formattedContent = await fileContentPrettyFormat(unformatedContent, {path: 'someFile.js'})

    // Then
    await expect(formattedContent).toEqual(`const foo = 'bar';\n`)
  })

  it('formats TypeScript file content', async () => {
    // Given
    const unformatedContent = 'const array: string[] = ["bar", "baz",]'

    // When
    const formattedContent = await fileContentPrettyFormat(unformatedContent, {path: 'someFile.ts'})

    // Then
    await expect(formattedContent).toEqual("const array: string[] = ['bar', 'baz'];\n")
  })

  it('formats TypeScript file content with JSX', async () => {
    // Given
    const unformatedContent = 'const C = (p: any) => <>{ p.foo }</>'

    // When
    const formattedContent = await fileContentPrettyFormat(unformatedContent, {path: 'someFile.tsx'})

    // Then
    await expect(formattedContent).toEqual('const C = (p: any) => <>{p.foo}</>;\n')
  })

  it('formats CSS file content', async () => {
    // Given
    const unformatedContent = 'body { color: red; }'

    // When
    const formattedContent = await fileContentPrettyFormat(unformatedContent, {path: 'someFile.css'})

    // Then
    await expect(formattedContent).toEqual(
      `body {
  color: red;
}
`,
    )
  })

  it('formats HTML file content', async () => {
    // Given
    const unformatedContent = `<div      >much extra space</div>`

    // When
    const formattedContent = await fileContentPrettyFormat(unformatedContent, {path: 'someFile.html'})

    // Then
    await expect(formattedContent).toEqual('<div>much extra space</div>\n')
  })
})

describe('appendFile', () => {
  test('it appends content to an existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = join(tmpDir, 'test-file')
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
      const filePath = join(tmpDir, 'taken-directory-app')
      await writeFile(filePath, content)

      // When
      const got = await generateRandomNameForSubdirectory({suffix: 'app', directory: tmpDir})

      // Then
      expect(got).toEqual('free-directory-app')
      expect(takeRandomFromArray).toHaveBeenCalledTimes(4)
    })
  })
})
