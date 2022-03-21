import {copy, mkdir, write, read, inTemporaryDirectory, exists} from './file'
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
