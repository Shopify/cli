import {showDeprecationWarnings, REQUIRED_FOLDERS, validThemeDirectory} from './dev.js'
import {describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'

describe('validThemeDirectory', () => {
  test('should not consider an empty directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await expect(validThemeDirectory(tmpDir)).resolves.toBe(false)
    })
  })

  test('should not consider an incomplete theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mkdir(joinPath(tmpDir, REQUIRED_FOLDERS[0]!))
      await expect(validThemeDirectory(tmpDir)).resolves.toBe(false)
    })
  })

  test('should consider a theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await Promise.all(REQUIRED_FOLDERS.map((requiredFolder) => mkdir(joinPath(tmpDir, requiredFolder))))
      await expect(validThemeDirectory(tmpDir)).resolves.toBe(true)
    })
  })
})

describe('showDeprecationWarnings', () => {
  test('does nothing when the -e flag includes a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', 'whatever'])

    // Then
    expect(outputMock.output()).toMatch('')
  })

  test('shows a warning message when the -e flag does not include a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })

  test('shows a warning message when the -e flag is followed by another flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', '--verbose'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })
})
