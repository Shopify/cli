import * as environments from './environments.js'
import {environmentsFilename} from './environments.js'
import {encodeToml as tomlEncode} from './toml.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

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
  test('returns an empty object when no environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      const loaded = await environments.loadEnvironmentsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('returns an empty object when an empty environments file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(joinPath(tmpDir, environmentsFilename), '# no content')

      // When
      const loaded = await environments.loadEnvironmentsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('returns available environments when they exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(joinPath(tmpDir, 'shopify.environments.toml'), tomlEncode({environment1, environment2}))

      // When
      const loaded = await environments.loadEnvironmentsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({environment1, environment2})
    })
  })

  test('does not search upwards for environments when no file exists and searching up is disabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(`${tmpDir}/shopify.environments.toml`, tomlEncode({environment1}))
      const subdir = joinPath(tmpDir, 'subdir')
      await mkdir(subdir)

      // When
      const loaded = await environments.loadEnvironmentsFromDirectory(subdir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('searches upwards for environments when no file exists and searching up is enabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(`${tmpDir}/shopify.environments.toml`, tomlEncode({environment1}))
      const subdir = joinPath(tmpDir, 'subdir')
      await mkdir(subdir)

      // When
      const loaded = await environments.loadEnvironmentsFromDirectory(subdir, {findUp: true})

      // Then
      expect(loaded).toEqual({environment1})
    })
  })
})
