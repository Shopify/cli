import {join as joinPath} from './path.js'
import {inTemporaryDirectory, mkdir, touch as touchFile} from './file.js'
import {getCliProjectDir, isCliProject} from './cli.js'
import {describe, expect, it} from 'vitest'

describe('isCliProject', () => {
  it('when one shopify app configuration file exists then return true', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await touchFile(joinPath(tmpDir, 'shopify.app.toml'))

      // When
      const got = await isCliProject(tmpDir)

      // Then
      expect(got).toBe(true)
    })
  })
  it('when none of the shopify app configuration file exist then return false', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await touchFile(joinPath(tmpDir, 'another.app.toml'))

      // When
      const got = await isCliProject(tmpDir)

      // Then
      expect(got).toBe(false)
    })
  })
})

describe('getCliProjectDir', () => {
  it('when one shopify app configuration file exists in the current directory then it is returned', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await touchFile(joinPath(tmpDir, 'shopify.app.toml'))

      // When
      const got = await getCliProjectDir(tmpDir)

      // Then
      expect(got).toBeDefined()
    })
  })
  it('when one shopify app configuration file exists in one of the upper directory then it is returned', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await touchFile(joinPath(tmpDir, 'shopify.app.toml'))
      const nestedDirectory = joinPath(tmpDir, 'web')
      await mkdir(nestedDirectory)

      // When
      const got = await getCliProjectDir(nestedDirectory)

      // Then
      expect(got).toBeDefined()
    })
  })
})
