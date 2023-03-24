import {showDeprecationWarnings, REQUIRED_FOLDERS, validThemeDirectory} from './dev.js'
import {describe, expect, it} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'

describe('validThemeDirectory', () => {
  it('should not consider an empty directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      expect(await validThemeDirectory(tmpDir)).toBe(false)
    })
  })

  it('should not consider an incomplete theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mkdir(joinPath(tmpDir, REQUIRED_FOLDERS[0]!))
      expect(await validThemeDirectory(tmpDir)).toBe(false)
    })
  })

  it('should consider a theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await Promise.all(REQUIRED_FOLDERS.map((requiredFolder) => mkdir(joinPath(tmpDir, requiredFolder))))
      expect(await validThemeDirectory(tmpDir)).toBe(true)
    })
  })
})

describe('showDeprecationWarnings', () => {
  it('does nothing when the -e flag includes a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', 'whatever'])

    // Then
    expect(outputMock.output()).toMatch('')
  })

  it('shows a warning message when the -e flag does not include a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })

  it('shows a warning message when the -e flag is followed by another flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', '--verbose'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })
})
