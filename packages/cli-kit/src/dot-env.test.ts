import {DotEnvNotFoundError, read, write} from './dot-env'
import {join as pathJoin} from './path'
import {write as writeFile} from './file'
import {describe, expect, test} from 'vitest'
import {temporary} from '@shopify/cli-testing'

describe('read', () => {
  test('throws an error if the file does not exist', async () => {
    // Given/When
    const dotEnvPath = '/invalid/path/.env'
    await expect(async () => {
      await read(dotEnvPath)
    }).rejects.toEqual(DotEnvNotFoundError(dotEnvPath))
  })

  test('returns the file if it exists and the format is valid', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR')

      // When
      const got = await read(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.content.FOO).toEqual('BAR')
    })
  })
})

describe('write', () => {
  test('creates a file if the .env does not exist', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')

      // When
      await write({
        path: dotEnvPath,
        content: {
          FOO: 'BAR',
        },
      })
      const got = await read(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.content.FOO).toEqual('BAR')
    })
  })

  test('overrides any existing file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR')

      // When
      await write({
        path: dotEnvPath,
        content: {
          FOO2: 'BAR2',
        },
      })
      const got = await read(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.content.FOO2).toEqual('BAR2')
    })
  })
})
