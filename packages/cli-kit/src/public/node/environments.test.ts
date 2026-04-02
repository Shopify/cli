import * as environments from './environments.js'
import {encodeToml as tomlEncode} from './toml/codec.js'
import {inTemporaryDirectory, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {describe, expect, test} from 'vitest'

const fileName = 'shopify.environments.toml'
const environment1 = {
  flag1: 'value',
  flag2: true,
  flag3: 0,
  flag4: ['hello', 'world'],
}
const environment2 = {
  flag1: 'value2',
  flag2: false,
  flag3: 1,
  flag4: ['goodbye', 'world'],
}

describe('loading environments', async () => {
  test('returns undefined when no environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toMatch(/Environment file not found/)
    })
  })

  test('returns undefined when an empty environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, '# no content')
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toMatch(/No environments found in/)
    })
  })

  test('returns undefined when the environment does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, tomlEncode({environments: {environment1, environment2}}))
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('wrong', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toMatch(/Environment `wrong` not found/)
    })
  })

  test('returns the environment when it exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, tomlEncode({environments: {environment1, environment2}}))

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir})

      // Then
      expect(loaded).toEqual(environment1)
    })
  })

  test('suppresses warning when no environments file exists with silent option', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir, silent: true})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toEqual('')
    })
  })

  test('suppresses warning when an empty environments file exists with silent option', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, '# no content')
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir, silent: true})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toEqual('')
    })
  })

  test('suppresses warning when the environment does not exist with silent option', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, tomlEncode({environments: {environment1, environment2}}))
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      const loaded = await environments.loadEnvironment('wrong', fileName, {from: tmpDir, silent: true})

      // Then
      expect(loaded).toBeUndefined()
      expect(outputMock.warn()).toEqual('')
    })
  })
})

const globFileName = 'shopify.theme.toml'
const globEnvironments = {
  'us-production': {store: 'us.myshopify.com'},
  'eu-production': {store: 'eu.myshopify.com'},
  'int-production': {store: 'int.myshopify.com'},
  staging: {store: 'staging.myshopify.com'},
  development: {store: 'dev.myshopify.com'},
}

describe('getEnvironmentNames', () => {
  test('returns all environment names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const names = await environments.getEnvironmentNames(globFileName, {from: tmpDir})

      expect(names).toEqual(['us-production', 'eu-production', 'int-production', 'staging', 'development'])
    })
  })

  test('returns empty array when no file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const names = await environments.getEnvironmentNames(globFileName, {from: tmpDir})

      expect(names).toEqual([])
    })
  })

  test('returns empty array when no environments section exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, '# no content')

      const names = await environments.getEnvironmentNames(globFileName, {from: tmpDir})

      expect(names).toEqual([])
    })
  })
})

describe('expandEnvironmentPatterns', () => {
  test('passes through literal names unchanged', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['staging'], globFileName, {from: tmpDir})

      expect(result).toEqual(['staging'])
    })
  })

  test('expands * wildcard to matching environments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['*-production'], globFileName, {from: tmpDir})

      expect(result).toEqual(['us-production', 'eu-production', 'int-production'])
    })
  })

  test('expands ? single-character wildcard', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['??-production'], globFileName, {from: tmpDir})

      expect(result).toEqual(['us-production', 'eu-production'])
    })
  })

  test('expands [abc] character class', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['[ue]*-production'], globFileName, {from: tmpDir})

      expect(result).toEqual(['us-production', 'eu-production'])
    })
  })

  test('expands {a,b} brace expansion', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['{us,eu}-production'], globFileName, {from: tmpDir})

      expect(result).toEqual(['us-production', 'eu-production'])
    })
  })

  test('deduplicates environments matched by multiple patterns', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))

      const result = await environments.expandEnvironmentPatterns(['us-*', '*-production'], globFileName, {
        from: tmpDir,
      })

      expect(result).toEqual(['us-production', 'eu-production', 'int-production'])
    })
  })

  test('warns when a pattern matches nothing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      const result = await environments.expandEnvironmentPatterns(['*-sandbox'], globFileName, {from: tmpDir})

      expect(result).toEqual([])
      expect(outputMock.warn()).toMatch(/No environments matching/)
    })
  })

  test('returns matches from valid patterns even when another pattern matches nothing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, globFileName)
      await writeFile(filePath, tomlEncode({environments: globEnvironments}))
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      const result = await environments.expandEnvironmentPatterns(['staging', '*-sandbox'], globFileName, {
        from: tmpDir,
      })

      expect(result).toEqual(['staging'])
      expect(outputMock.warn()).toMatch(/No environments matching/)
    })
  })

  test('returns empty array when no environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const result = await environments.expandEnvironmentPatterns(['*'], globFileName, {from: tmpDir})

      expect(result).toEqual([])
    })
  })
})
