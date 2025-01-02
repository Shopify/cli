import {addUidToTomlsIfNecessary} from './add-uid-to-extension-toml.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {testDeveloperPlatformClient, testUIExtension} from '../../models/app/app.test-data.js'
import {describe, test, expect} from 'vitest'
import {writeFile, readFile, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('addUidToTomlsIfNecessary', () => {
  test('skips if platform does not support atomic deployments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlPath = joinPath(tmpDir, 'extension.toml')
      const tomlContent = `
        type = "checkout_ui_extension"
        handle = "my-extension"
      `
      await writeFile(tomlPath, tomlContent)

      const extension = await testUIExtension({
        directory: tmpDir,
        configuration: {
          handle: 'my-extension',
          type: 'checkout_ui_extension',
          name: 'test',
        },
        configurationPath: tomlPath,
        uid: '123',
      })

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: false})

      // When
      await addUidToTomlsIfNecessary([extension], client)

      // Then
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toBe(tomlContent)
    })
  })

  test('adds uid to single extension TOML', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlPath = joinPath(tmpDir, 'extension.toml')
      const tomlContent = `
        type = "checkout_ui_extension"
        handle = "my-extension"
      `
      await writeFile(tomlPath, tomlContent)

      const extension = {
        configurationPath: tomlPath,
        handle: 'my-extension',
        isUUIDStrategyExtension: true,
        uid: '123',
        configuration: {},
      } as ExtensionInstance

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: true})

      // When
      await addUidToTomlsIfNecessary([extension], client)

      // Then
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toContain('uid = "123"')
      expect(updatedContent).toMatch(/uid.*type/s)
    })
  })

  test('adds uid to multi-extension TOML', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlPath = joinPath(tmpDir, 'extension.toml')
      const tomlContent = `
        [[extensions]]
        type = "checkout_ui_extension"
        handle = "extension-1"

        [[extensions]]
        type = "checkout_ui_extension"
        handle = "extension-2"
      `
      await writeFile(tomlPath, tomlContent)

      const extension = {
        configurationPath: tomlPath,
        handle: 'extension-2',
        isUUIDStrategyExtension: true,
        uid: '456',
        configuration: {},
      } as ExtensionInstance

      const extension1 = {
        configurationPath: tomlPath,
        handle: 'extension-1',
        isUUIDStrategyExtension: true,
        uid: '123',
        configuration: {},
      } as ExtensionInstance

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: true})

      // When
      await addUidToTomlsIfNecessary([extension, extension1], client)

      // Then
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toBe(`
        [[extensions]]
        type = "checkout_ui_extension"
        handle = "extension-1"
        uid = "123"

        [[extensions]]
        type = "checkout_ui_extension"
        handle = "extension-2"
        uid = "456"
      `)
    })
  })

  test('skips if extension already has uid in configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlPath = joinPath(tmpDir, 'extension.toml')
      const tomlContent = `
        type = "checkout_ui_extension"
        handle = "my-extension"
        uid = "existing-uid"
      `
      await writeFile(tomlPath, tomlContent)

      const extension = {
        configurationPath: tomlPath,
        handle: 'my-extension',
        isUUIDStrategyExtension: true,
        uid: '123',
        configuration: {
          uid: 'existing-uid',
        },
      } as ExtensionInstance

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: true})

      // When
      await addUidToTomlsIfNecessary([extension], client)

      // Then
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toBe(tomlContent)
    })
  })

  test('skips if extension is not UUID strategy extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlPath = joinPath(tmpDir, 'extension.toml')
      const tomlContent = `
        type = "checkout_ui_extension"
        handle = "my-extension"
      `
      await writeFile(tomlPath, tomlContent)

      const extension = {
        configurationPath: tomlPath,
        handle: 'my-extension',
        isUUIDStrategyExtension: false,
        uid: '123',
        configuration: {},
      } as ExtensionInstance

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: true})

      // When
      await addUidToTomlsIfNecessary([extension], client)

      // Then
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toBe(tomlContent)
    })
  })
})
