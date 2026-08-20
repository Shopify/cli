import {fetchChannelSpecExport} from './fetch.js'
import {generateChannelSpec, CHANNEL_SPEC_DIRECTORY} from './generate.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('./fetch.js')

const TOML = 'handle = "example"\nlabel = "Example Channel"\n'

function successResult(warnings: {code: string; message: string}[] = []) {
  return {
    success: true as const,
    handle: 'example',
    filename: 'example.toml',
    toml: TOML,
    warnings,
  }
}

function testOptions(app: AppLinkedInterface, {stdout = false, overwrite = false} = {}) {
  return {
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    stdout,
    overwrite,
  }
}

describe('generateChannelSpec', () => {
  test('writes the TOML to the channel-config specifications directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await generateChannelSpec(testOptions(app))

      // Then
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await expect(fileExists(outputPath)).resolves.toBe(true)
      await expect(readFile(outputPath)).resolves.toEqual(TOML)
      expect(outputMock.info()).toContain('Generated a channel spec')
      expect(outputMock.info()).toContain('shopify app deploy')
    })
  })

  test('refuses to overwrite an existing spec without --overwrite', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, 'existing = true\n')

      // When/Then
      await expect(generateChannelSpec(testOptions(app))).rejects.toThrow(/already exists/)
      await expect(readFile(outputPath)).resolves.toEqual('existing = true\n')
    })
  })

  test('overwrites an existing spec with --overwrite', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, 'existing = true\n')

      // When
      await generateChannelSpec(testOptions(app, {overwrite: true}))

      // Then
      await expect(readFile(outputPath)).resolves.toEqual(TOML)
    })
  })

  test('prints only the TOML to stdout with --stdout, keeping warnings out-of-band', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const warning = {
        code: 'automatic_product_feed_management',
        message:
          'This generated spec enables automatic product feed management. Review the generated configuration before deploying.',
      }
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult([warning]))
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await generateChannelSpec(testOptions(app, {stdout: true}))

      // Then
      expect(outputMock.output()).toContain(TOML)
      expect(outputMock.output()).not.toContain(warning.code)
      expect(outputMock.warn()).toContain(warning.message)
      await expect(fileExists(joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml'))).resolves.toBe(false)
    })
  })

  test('renders backend warnings when writing the file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const warning = {
        code: 'automatic_product_feed_management',
        message:
          'This generated spec enables automatic product feed management. Review the generated configuration before deploying.',
      }
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult([warning]))
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await generateChannelSpec(testOptions(app))

      // Then
      expect(outputMock.warn()).toContain(warning.message)
      await expect(readFile(joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml'))).resolves.not.toContain(
        warning.message,
      )
    })
  })

  test('aborts with partner-facing guidance when no export is available', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue({success: false, reason: 'no_exportable_frozen_record'})
      const app = testAppLinked({directory: tmpDir})

      // When/Then
      await expect(generateChannelSpec(testOptions(app))).rejects.toThrow(
        /No deployable channel spec is available for this app yet/,
      )
    })
  })

  test('aborts with the reason code when the backend returns an unknown reason', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue({success: false, reason: 'mystery_reason'})
      const app = testAppLinked({directory: tmpDir})

      // When/Then
      await expect(generateChannelSpec(testOptions(app))).rejects.toThrow(/mystery_reason/)
    })
  })
})
