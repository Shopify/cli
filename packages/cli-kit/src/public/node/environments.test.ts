import * as environments from './environments.js'
import {encodeToml as tomlEncode} from './toml.js'
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

describe('getEnvironmentNames', () => {
  test('returns all environment names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, tomlEncode({environments: {environment1, environment2}}))

      // When
      const names = await environments.getEnvironmentNames(fileName, {from: tmpDir})

      // Then
      expect(names).toEqual(['environment1', 'environment2'])
    })
  })

  describe('when no environment file exists', () => {
    test('returns empty array', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // When
        const names = await environments.getEnvironmentNames(fileName, {from: tmpDir})

        // Then
        expect(names).toEqual([])
      })
    })
  })

  describe('when environment file is empty', () => {
    test('returns empty array', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const filePath = joinPath(tmpDir, fileName)
        await writeFile(filePath, '# no content')

        // When
        const names = await environments.getEnvironmentNames(fileName, {from: tmpDir})

        // Then
        expect(names).toEqual([])
      })
    })
  })
})

describe('expandEnvironmentPatterns', () => {
  test('returns dedeuplicated environment names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(
        filePath,
        tomlEncode({
          environments: {
            'us-production': {store: 'us-store'},
            'ca-production': {store: 'ca-store'},
          },
        }),
      )

      // When
      const expanded = await environments.expandEnvironmentPatterns(['us-production', 'us-production'], fileName, {
        from: tmpDir,
      })

      // Then
      expect(expanded).toEqual(['us-production'])
    })
  })

  describe('when the pattern contains glob characters', () => {
    test('expands glob pattern to return multiple environments', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const filePath = joinPath(tmpDir, fileName)
        await writeFile(
          filePath,
          tomlEncode({
            environments: {
              'us-production': {store: 'us-store'},
              'ca-production': {store: 'ca-store'},
              'de-production': {store: 'de-store'},
              'us-staging': {store: 'us-staging-store'},
            },
          }),
        )

        // When
        const expanded = await environments.expandEnvironmentPatterns(['*-production'], fileName, {from: tmpDir})

        // Then
        expect(expanded.sort()).toEqual(['ca-production', 'de-production', 'us-production'])
      })
    })

    test('supports question mark glob patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const filePath = joinPath(tmpDir, fileName)
        await writeFile(
          filePath,
          tomlEncode({
            environments: {
              'us-production': {store: 'us-store'},
              'uk-production': {store: 'uk-store'},
              'usa-production': {store: 'usa-store'},
            },
          }),
        )

        // When
        const expanded = await environments.expandEnvironmentPatterns(['u?-production'], fileName, {from: tmpDir})

        // Then
        expect(expanded.sort()).toEqual(['uk-production', 'us-production'])
      })
    })

    test('supports square bracket glob patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const filePath = joinPath(tmpDir, fileName)
        await writeFile(
          filePath,
          tomlEncode({
            environments: {
              'us-production': {store: 'us-store'},
              'uk-production': {store: 'uk-store'},
              'usa-production': {store: 'usa-store'},
            },
          }),
        )

        // When
        const expanded = await environments.expandEnvironmentPatterns(['u[a-z]-production'], fileName, {from: tmpDir})

        // Then
        expect(expanded.sort()).toEqual(['uk-production', 'us-production'])
      })
    })

    test('supports curly bracket glob patterns', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const filePath = joinPath(tmpDir, fileName)
        await writeFile(
          filePath,
          tomlEncode({
            environments: {
              'us-production': {store: 'us-store'},
              'uk-production': {store: 'uk-store'},
              'usa-production': {store: 'usa-store'},
            },
          }),
        )

        // When
        const expanded = await environments.expandEnvironmentPatterns(['{uk,us}-production'], fileName, {from: tmpDir})

        // Then
        expect(expanded.sort()).toEqual(['uk-production', 'us-production'])
      })
    })
  })

  test('renders a warning if no match is found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(
        filePath,
        tomlEncode({
          environments: {
            'us-production': {store: 'us-store'},
          },
        }),
      )

      // When
      const expanded = await environments.expandEnvironmentPatterns(['nonexistent'], fileName, {from: tmpDir})

      // Then
      expect(expanded).toEqual([])
      expect(outputMock.warn()).toMatchInlineSnapshot(`
        "╭─ warning ────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Could not find any environments matching \`nonexistent\`                      │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })
  })
})
