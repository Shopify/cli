import {DotEnvNotFoundError, patchEnvFile, readAndParseDotEnv, writeDotEnv} from './dot-env.js'
import {join as pathJoin} from '../../path.js'
import {inTemporaryDirectory, write as writeFile, read as readFile} from '../../file.js'
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

describe('patchEnvFile', () => {
  test('patches an environment file without changing not relevant content', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)
      expect(got.variables).toEqual({
        FOO: 'BAR',
        ABC: 'XYZ',
        DEF: 'GHI',
      })

      // Then
      const patchedContent = patchEnvFile(await readFile(dotEnvPath), {ABC: '123'})
      expect(patchedContent).toEqual('FOO=BAR\nABC=123\n#Wow!\n\n  DEF  =GHI')
    })
  })

  test('patches an environment file without changing not relevant content in Windows', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = pathJoin(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI\r\nWIN=DOWS')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)
      expect(got.variables).toEqual({
        FOO: 'BAR',
        ABC: 'XYZ',
        DEF: 'GHI',
        WIN: 'DOWS',
      })

      // Then
      const patchedContent = patchEnvFile(await readFile(dotEnvPath), {ABC: '123'})
      expect(patchedContent).toEqual('FOO=BAR\nABC=123\n#Wow!\n\n  DEF  =GHI\r\nWIN=DOWS')
    })
  })
})
