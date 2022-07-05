import {DotEnvNotFoundError, readAndParseDotEnv, writeDotEnv} from './dot-env.js'
import {join as pathJoin} from '../path.js'
import {inTemporaryDirectory, write as writeFile} from '../file.js'
import {describe, expect, test} from 'vitest'

describe('readAndParseDotEnv', () => {
  test('throws an error if the file does not exist', async () => {
    // Given/When
    const dotEnvPath = '/invalid/path/.env'
    await expect(async () => {
      await readAndParseDotEnv(dotEnvPath)
    }).rejects.toEqual(DotEnvNotFoundError(dotEnvPath))
  })

  test('returns the file if it exists and the format is valid', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.FOO).toEqual('BAR')
    })
  })
})

describe('writeDotEnv', () => {
  test('creates a file if the .env does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')

      // When
      await writeDotEnv({
        path: dotEnvPath,
        variables: {
          FOO: 'BAR',
        },
      })
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.FOO).toEqual('BAR')
    })
  })

  test('overrides any existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR')

      // When
      await writeDotEnv({
        path: dotEnvPath,
        variables: {
          FOO2: 'BAR2',
        },
      })
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.FOO2).toEqual('BAR2')
    })
  })
})
