import {fetchChannelSpecExport} from './fetch.js'
import {importChannelConfig, CHANNEL_SPEC_DIRECTORY, CHANNEL_SPEC_EXTENSION_DIRECTORY} from './import.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {
  testAppLinked,
  testChannelConfigExtension,
  testDeveloperPlatformClient,
  testOrganizationApp,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('./fetch.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

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

function testOptions(app: AppLinkedInterface, {force = false, json = false} = {}) {
  return {
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    force,
    json,
  }
}

describe('importChannelConfig', () => {
  test('writes the TOML to the channel-config specifications directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await importChannelConfig(testOptions(app))

      // Then
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await expect(fileExists(outputPath)).resolves.toBe(true)
      await expect(readFile(outputPath)).resolves.toEqual(TOML)
      expect(outputMock.info()).toContain('Imported the channel spec')
      expect(outputMock.info()).toContain('shopify app dev')
      expect(outputMock.info()).toContain('shopify app deploy')
    })
  })

  test('refuses to overwrite an existing spec without --force', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, 'existing = true\n')

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow(/already exists/)
      await expect(readFile(outputPath)).resolves.toEqual('existing = true\n')
    })
  })

  test('overwrites an existing spec with --force', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, 'existing = true\n')

      // When
      await importChannelConfig(testOptions(app, {force: true}))

      // Then
      await expect(readFile(outputPath)).resolves.toEqual(TOML)
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
      await importChannelConfig(testOptions(app))

      // Then
      expect(outputMock.warn()).toContain('This generated spec enables automatic product feed management.')
      await expect(readFile(joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml'))).resolves.not.toContain(
        'product feed management',
      )
    })
  })

  test('aborts with partner-facing guidance when no export is available', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue({success: false, reason: 'no_exportable_frozen_record'})
      const app = testAppLinked({directory: tmpDir})

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow(
        /doesn't have a channel spec that can be exported yet/,
      )
    })
  })

  test('aborts with the reason code when the backend returns an unknown reason', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue({success: false, reason: 'mystery_reason'})
      const app = testAppLinked({directory: tmpDir})

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow(/mystery_reason/)
    })
  })

  test('emits the encoded JSON result and still writes the file in --json mode', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const warning = {code: 'missing_countries', message: 'Add a countries section.'}
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult([warning]))
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await importChannelConfig(testOptions(app, {json: true}))

      // Then
      const outputPath = joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      await expect(fileExists(outputPath)).resolves.toBe(true)
      const parsed = JSON.parse(outputMock.info())
      expect(parsed).toEqual({
        handle: 'example',
        filename: 'example.toml',
        path: joinPath(CHANNEL_SPEC_DIRECTORY, 'example.toml'),
        toml: TOML,
        warnings: [warning],
      })
    })
  })

  test('confines the write to the specifications directory when the filename contains path segments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue({...successResult(), filename: '../../evil.toml'})
      const app = testAppLinked({directory: tmpDir})
      mockAndCaptureOutput()

      // When
      await importChannelConfig(testOptions(app))

      // Then
      await expect(fileExists(joinPath(tmpDir, 'evil.toml'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'evil.toml'))).resolves.toBe(true)
    })
  })

  test('creates a minimal shopify.extension.toml so the imported spec deploys', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({directory: tmpDir})
      const outputMock = mockAndCaptureOutput()

      // When
      await importChannelConfig(testOptions(app))

      // Then
      const extensionConfigPath = joinPath(tmpDir, CHANNEL_SPEC_EXTENSION_DIRECTORY, 'shopify.extension.toml')
      await expect(readFile(extensionConfigPath)).resolves.toContain('type = "channel_config"')
      expect(outputMock.info()).toContain('shopify.extension.toml')
    })
  })

  test('reuses an existing channel_config extension instead of creating a second one', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const extensionDirectory = joinPath(tmpDir, 'extensions', 'my-channel')
      const extensionConfigPath = joinPath(extensionDirectory, 'shopify.extension.toml')
      await mkdir(extensionDirectory)
      const existingContent = 'name = "My channel"\ntype = "channel_config"\nhandle = "my-channel"\n'
      await writeFile(extensionConfigPath, existingContent)
      const app = testAppLinked({
        directory: tmpDir,
        allExtensions: [await testChannelConfigExtension(extensionDirectory, 'my-channel')],
      })
      const outputMock = mockAndCaptureOutput()

      // When
      await importChannelConfig(testOptions(app))

      // Then
      await expect(readFile(joinPath(extensionDirectory, 'specifications', 'example.toml'))).resolves.toEqual(TOML)
      await expect(readFile(extensionConfigPath)).resolves.toEqual(existingContent)
      await expect(fileExists(joinPath(tmpDir, CHANNEL_SPEC_EXTENSION_DIRECTORY))).resolves.toBe(false)
      expect(outputMock.info()).not.toContain('Also created')
    })
  })

  test('honours --force inside an existing channel_config extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const extensionDirectory = joinPath(tmpDir, 'extensions', 'my-channel')
      const outputPath = joinPath(extensionDirectory, 'specifications', 'example.toml')
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, 'existing = true\n')
      const app = testAppLinked({
        directory: tmpDir,
        allExtensions: [await testChannelConfigExtension(extensionDirectory, 'my-channel')],
      })

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow('A channel spec already exists')
      await importChannelConfig(testOptions(app, {force: true}))
      await expect(readFile(outputPath)).resolves.toEqual(TOML)
    })
  })

  test('aborts when the app has more than one channel_config extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const app = testAppLinked({
        directory: tmpDir,
        allExtensions: [
          await testChannelConfigExtension(joinPath(tmpDir, 'extensions', 'one'), 'one'),
          await testChannelConfigExtension(joinPath(tmpDir, 'extensions', 'two'), 'two'),
        ],
      })

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow('more than one channel_config extension')
      await expect(fileExists(joinPath(tmpDir, 'extensions'))).resolves.toBe(false)
    })
  })

  test('aborts when extensions/channel-config is already used by a different extension type', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const extensionDirectory = joinPath(tmpDir, CHANNEL_SPEC_EXTENSION_DIRECTORY)
      const extensionConfigPath = joinPath(extensionDirectory, 'shopify.extension.toml')
      await mkdir(extensionDirectory)
      const existingContent = 'name = "Some other extension"\ntype = "ui_extension"\nhandle = "something-else"\n'
      await writeFile(extensionConfigPath, existingContent)
      const app = testAppLinked({
        directory: tmpDir,
        allExtensions: [await testUIExtension({directory: extensionDirectory, type: 'ui_extension'})],
      })

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow('already contains a ui_extension extension')
      await expect(readFile(extensionConfigPath)).resolves.toEqual(existingContent)
      await expect(fileExists(joinPath(tmpDir, CHANNEL_SPEC_DIRECTORY, 'example.toml'))).resolves.toBe(false)
    })
  })

  test('aborts when extension_directories would not pick up a new extensions/channel-config extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const base = testAppLinked({directory: tmpDir})
      const app = testAppLinked({
        directory: tmpDir,
        configuration: {...base.configuration, extension_directories: ['plugins/*']},
      })

      // When/Then
      await expect(importChannelConfig(testOptions(app))).rejects.toThrow('only loads extensions from plugins/*')
      await expect(fileExists(joinPath(tmpDir, 'extensions'))).resolves.toBe(false)
    })
  })

  test('creates the extension when extension_directories includes extensions/*', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(fetchChannelSpecExport).mockResolvedValue(successResult())
      const base = testAppLinked({directory: tmpDir})
      const app = testAppLinked({
        directory: tmpDir,
        configuration: {...base.configuration, extension_directories: ['plugins/*', 'extensions/*']},
      })

      // When
      await importChannelConfig(testOptions(app))

      // Then
      await expect(
        fileExists(joinPath(tmpDir, CHANNEL_SPEC_EXTENSION_DIRECTORY, 'shopify.extension.toml')),
      ).resolves.toBe(true)
    })
  })
})
