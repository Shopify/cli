import {copy, mkdir, write, read, inTemporaryDirectory, exists, move, chmod} from './file'
import {join} from './path'
import {describe, test, expect, it} from 'vitest'
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

describe('chmod', () => {
  it('changes the permissions of a file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const filePath = join(tmpDir, 'from')
      await write(filePath, content)

      // When/Then
      await chmod(filePath, '777')
    })
  })
})
