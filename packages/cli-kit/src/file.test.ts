import {
  copy,
  mkdir,
  hasExecutablePermissions,
  write,
  read,
  inTemporaryDirectory,
  exists,
  move,
  chmod,
  append,
  remove,
  stripUp,
  format,
} from './file'
import {join} from './path'
import {describe, expect, it} from 'vitest'
import {temporary} from '@shopify/cli-testing'

describe('inTemporaryDirectory', () => {
  it('ties the lifecycle of the temporary directory to the lifecycle of the callback', async () => {
    // Given
    let gotTmpDir = ''

    await inTemporaryDirectory(async (tmpDir) => {
      gotTmpDir = tmpDir
      const filePath = join(tmpDir, 'test-file')
      const content = 'test-content'
      await write(filePath, content)
      await expect(exists(filePath)).resolves.toBe(true)
    })

    // Then
    await expect(exists(gotTmpDir)).resolves.toBe(false)
  })
})
describe('copy', () => {
  it('copies the file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const to = join(tmpDir, 'to')
      await write(from, content)

      // When
      await copy(from, to)

      // Then
      const got = await read(to)
      expect(got).toEqual(content)
    })
  })

  it('copies the directory recursively including dot files', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const fromChild = join(from, 'child')
      const to = join(tmpDir, 'to')
      await mkdir(from)
      await mkdir(fromChild)
      await write(join(from, 'file'), content)
      await write(join(fromChild, '.dotfile'), content)

      // When
      await copy(from, to)

      // Then
      await expect(read(join(to, 'file'))).resolves.toEqual(content)
      await expect(read(join(to, 'child', '.dotfile'))).resolves.toEqual(content)
    })
  })
})

describe('move', () => {
  it('moves files', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const to = join(tmpDir, 'to')
      await write(from, content)

      // When
      await move(from, to)

      // Then
      const got = await read(to)
      expect(got).toEqual(content)
    })
  })
})

describe('exists', () => {
  it('returns true when the file exists', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await write(filePath, content)

      // When
      const got = await exists(filePath)

      // Then
      expect(got).toEqual(true)
    })
  })

  it('returns false when the file does not exist', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const filePath = join(tmpDir, 'from')

      // When
      const got = await exists(filePath)

      // Then
      expect(got).toEqual(false)
    })
  })
})

describe('append', () => {
  it('appends content to an existing file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await write(filePath, content)

      // When
      await append(filePath, '-appended')

      // Then
      const got = await read(filePath)
      expect(got).toEqual(`${content}-appended`)
    })
  })
})

describe('chmod', () => {
  it('changes the permissions of a file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await write(filePath, content)

      // When
      await chmod(filePath, '777')

      // Then
      await expect(hasExecutablePermissions(filePath)).resolves.toEqual(true)
    })
  })
})

describe('remove', () => {
  it('removes a file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await write(filePath, content)

      // When
      await remove(filePath)

      // Then
      await expect(exists(filePath)).resolves.toEqual(false)
    })
  })
})

describe('stripUp', () => {
  it('strips the given amount of leading directories', async () => {
    // Given
    const filePath = 'a/b/c/d/e'

    // When
    const newFilePath1 = stripUp(filePath, 1)
    const newFilePath2 = stripUp(filePath, 2)
    const newFilePath3 = stripUp(filePath, 3)

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
    const formattedContent = await format(unformatedContent, {path: 'someFile.js'})

    // Then
    await expect(formattedContent).toEqual(`const foo = 'bar';\n`)
  })

  it('formats TypeScript file content', async () => {
    // Given
    const unformatedContent = 'const array: string[] = ["bar", "baz",]'

    // When
    const formattedContent = await format(unformatedContent, {path: 'someFile.ts'})

    // Then
    await expect(formattedContent).toEqual("const array: string[] = ['bar', 'baz'];\n")
  })

  it('formats CSS file content', async () => {
    // Given
    const unformatedContent = 'body { color: red; }'

    // When
    const formattedContent = await format(unformatedContent, {path: 'someFile.css'})

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
    const formattedContent = await format(unformatedContent, {path: 'someFile.html'})

    // Then
    await expect(formattedContent).toEqual('<div>much extra space</div>\n')
  })
})
