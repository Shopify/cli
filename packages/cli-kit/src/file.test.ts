import {describe, test, expect, it} from 'vitest'
import {temporary} from '@shopify/cli-testing'

import {copy, mkdir, write, read} from './file'
import {join} from './path'

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

  it('copies the directory recursively', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const from = join(tmpDir, 'from')
      const to = join(tmpDir, 'to')
      await mkdir(from)
      await write(join(from, 'file'), content)

      // When
      await copy(from, to)

      // Then
      const got = await read(join(to, 'file'))
      expect(got).toEqual(content)
    })
  })
})
