import {patchEnvFile, readAndParseDotEnv, writeDotEnv, createDotEnvFileLine, cleanUpEnvFile} from './dot-env.js'
import {inTemporaryDirectory, writeFile, readFile, fileExists} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

describe('readAndParseDotEnv', () => {
  test('throws an error if the file does not exist', async () => {
    // Given/When
    const dotEnvPath = '/invalid/path/.env'
    await expect(async () => {
      await readAndParseDotEnv(dotEnvPath)
    }).rejects.toThrow(/The environment file at .* does not exist./)
  })

  test('returns the file if it exists and the format is valid', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.FOO).toEqual('BAR')
    })
  })

  test('ensures newline characters are parsed from .env file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')

      await writeFile(dotEnvPath, `FOO="BAR\nBAR\nBAR"`)

      // When
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.FOO).toEqual('BAR\nBAR\nBAR')
    })
  })
})

describe('writeDotEnv', () => {
  test('creates a file if the .env does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')

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

  test('creates a file with multiline env vars', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')

      // When
      await writeDotEnv({
        path: dotEnvPath,
        variables: {
          FOO: 'BAR',
          MULTI: 'LINE\nVARIABLE',
        },
      })
      const got = await readAndParseDotEnv(dotEnvPath)

      // Then
      expect(got.path).toEqual(dotEnvPath)
      expect(got.variables.MULTI).toEqual('LINE\nVARIABLE')
    })
  })

  test('overrides any existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
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
      const dotEnvPath = joinPath(tmpDir, '.env')
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
      const dotEnvPath = joinPath(tmpDir, '.env')
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

  test('patches an environment file containing newline characters', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO="BAR\nBAR\nBAR"\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)
      expect(got.variables).toEqual({
        FOO: 'BAR\nBAR\nBAR',
        ABC: 'XYZ',
        DEF: 'GHI',
      })

      // Then
      const patchedContent = patchEnvFile(await readFile(dotEnvPath), {ABC: '123'})
      expect(patchedContent).toEqual('FOO="BAR\nBAR\nBAR"\nABC=123\n#Wow!\n\n  DEF  =GHI')
    })
  })

  test('patches env var with newline characters', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO="BAR\nBAR\nBAR"\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)
      expect(got.variables).toEqual({
        FOO: 'BAR\nBAR\nBAR',
        ABC: 'XYZ',
        DEF: 'GHI',
      })

      // Then
      const patchedContent = patchEnvFile(await readFile(dotEnvPath), {FOO: 'BAZ\nBAZ\nBAZ'})
      expect(patchedContent).toEqual('FOO="BAZ\nBAZ\nBAZ"\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI')
    })
  })

  test('patches an environment file and creates a new env var with newline characters', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI')

      // When
      const got = await readAndParseDotEnv(dotEnvPath)
      expect(got.variables).toEqual({
        FOO: 'BAR',
        ABC: 'XYZ',
        DEF: 'GHI',
      })

      // Then
      const patchedContent = patchEnvFile(await readFile(dotEnvPath), {MULTI: 'LINE\nVARIABLE'})
      expect(patchedContent).toEqual('FOO=BAR\nABC   =XYZ\n#Wow!\n\n  DEF  =GHI\nMULTI="LINE\nVARIABLE"')
    })
  })

  test(`throws error when multiline environment variable isn't closed`, async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      await writeFile(dotEnvPath, 'FOO=BAR\nABC   ="XYZ\n#Wow!\n\n  DEF  =GHI')

      // Then
      await expect(async () => {
        patchEnvFile(await readFile(dotEnvPath), {MULTI: 'LINE\nVARIABLE'})
      }).rejects.toThrow(`Multi-line environment variable 'ABC' is not properly enclosed.`)
    })
  })
})

describe('createDotEnvFileLine', () => {
  test('creates an env var for a .env file', () => {
    const line = createDotEnvFileLine('FOO', 'BAR')

    expect(line).toEqual('FOO=BAR')
  })

  test('creates a multiline env var for a .env file', () => {
    const line = createDotEnvFileLine('FOO', 'BAR\nBAR\nBAR')

    expect(line).toEqual('FOO="BAR\nBAR\nBAR"')
  })

  test('creates a multiline env var for a .env file with double-quotes', () => {
    const line = createDotEnvFileLine('FOO', 'BAR\n"BAR"\nBAR')

    expect(line).toEqual(`FOO='BAR\n"BAR"\nBAR'`)
  })

  test('creates a multiline env var for a .env file with double-quotes and single-quotes', () => {
    const line = createDotEnvFileLine('FOO', `BAR\n"BAR"\n'BAR'`)

    expect(line).toEqual(`FOO=\`BAR\n"BAR"\n'BAR'\``)
  })

  test('throws AbortError when trying to create a multiline env var with single-quote, double-quote and tilde', async () => {
    const value = `\`BAR\`\n"BAR"\n'BAR'`
    await expect(async () => {
      createDotEnvFileLine('FOO', value)
    }).rejects.toThrow(`The environment file patch has an env value that can't be surrounded by quotes: ${value}`)
  })
})

describe('cleanUpEnvFile', () => {
  test('removes specified environment variables and keeps the rest', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {
          FOO: 'BAR',
          KEEP_ME: 'VALUE',
          REMOVE_ME: 'DELETE',
          ANOTHER_KEEP: 'KEEP',
          ALSO_REMOVE: 'DELETE_TOO',
        },
      }
      await writeDotEnv(initialFile)

      // When
      await cleanUpEnvFile(initialFile, ['REMOVE_ME', 'ALSO_REMOVE'])

      // Then
      const updatedFile = await readAndParseDotEnv(dotEnvPath)
      expect(updatedFile.variables).toEqual({
        FOO: 'BAR',
        KEEP_ME: 'VALUE',
        ANOTHER_KEEP: 'KEEP',
      })
    })
  })

  test('removes the file when all variables are removed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {
          REMOVE_ME: 'DELETE',
          ALSO_REMOVE: 'DELETE_TOO',
        },
      }
      await writeDotEnv(initialFile)

      // When
      await cleanUpEnvFile(initialFile, ['REMOVE_ME', 'ALSO_REMOVE'])

      // Then
      const fileStillExists = await fileExists(dotEnvPath)
      expect(fileStillExists).toBe(false)
    })
  })

  test('handles partial matches correctly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {
          FOO: 'BAR',
          FOO_BAR: 'BAZ',
          PREFIX_FOO: 'QUX',
        },
      }
      await writeDotEnv(initialFile)

      // When
      await cleanUpEnvFile(initialFile, ['FOO'])

      // Then
      const updatedFile = await readAndParseDotEnv(dotEnvPath)
      expect(updatedFile.variables).toEqual({
        FOO_BAR: 'BAZ',
        PREFIX_FOO: 'QUX',
      })
    })
  })

  test('preserves multiline variables that are not removed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {
          MULTILINE: 'LINE1\nLINE2\nLINE3',
          REMOVE_ME: 'DELETE',
          ANOTHER: 'VALUE',
        },
      }
      await writeDotEnv(initialFile)

      // When
      await cleanUpEnvFile(initialFile, ['REMOVE_ME'])

      // Then
      const updatedFile = await readAndParseDotEnv(dotEnvPath)
      expect(updatedFile.variables).toEqual({
        MULTILINE: 'LINE1\nLINE2\nLINE3',
        ANOTHER: 'VALUE',
      })
    })
  })

  test('removes the file when starting with an empty variables object', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {},
      }
      await writeDotEnv(initialFile)

      // When
      await cleanUpEnvFile(initialFile, ['ANYTHING'])

      // Then
      const fileStillExists = await fileExists(dotEnvPath)
      expect(fileStillExists).toBe(false)
    })
  })

  test('doesnt do anything if file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dotEnvPath = joinPath(tmpDir, '.env')
      const initialFile = {
        path: dotEnvPath,
        variables: {
          FOO: 'BAR',
        },
      }

      // When
      await cleanUpEnvFile(initialFile, ['ANYTHING'])

      // Then
      const fileStillExists = await fileExists(dotEnvPath)
      expect(fileStillExists).toBe(false)
    })
  })
})
