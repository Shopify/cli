import * as environments from './environments.js'
import {encodeToml as tomlEncode} from './toml.js'
import {inTemporaryDirectory, writeFile} from './fs.js'
import {joinPath} from './path.js'
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
      // Given / When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
    })
  })

  test('returns undefined when an empty environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, '# no content')

      // When
      const loaded = await environments.loadEnvironment('environment1', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
    })
  })

  test('returns undefined when the environment does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, fileName)
      await writeFile(filePath, tomlEncode({environments: {environment1, environment2}}))

      // When
      const loaded = await environments.loadEnvironment('wrong', fileName, {from: tmpDir})

      // Then
      expect(loaded).toBeUndefined()
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
})
