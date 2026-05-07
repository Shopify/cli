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
    })
  })

  test('adds uid inside the [[extensions]] block for a single-entry array TOML (matching the app init template shape)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given — a TOML using the modern `[[extensions]]` array-of-tables shape with a
      // single extension. This is the shape produced by `shopify app init` templates.
      const tomlPath = joinPath(tmpDir, 'shopify.extension.toml')
      const tomlContent = `api_version = "2026-07"

[[extensions]]
# Change the merchant-facing name of the extension in locales/en.default.json
name = "t:name"
handle = "app-home"
type = "ui_extension"

[[extensions.targeting]]
module = "./src/AppHome.jsx"
target = "admin.app.home.render"

[access_scopes]
scopes = "write_metaobject_definitions,write_metaobjects,write_products"
`
      await writeFile(tomlPath, tomlContent)

      const extension = {
        configurationPath: tomlPath,
        handle: 'app-home',
        isUUIDStrategyExtension: true,
        uid: 'abc-123',
        configuration: {},
      } as ExtensionInstance

      const client = testDeveloperPlatformClient({supportsAtomicDeployments: true})

      // When
      await addUidToTomlsIfNecessary([extension], client)

      // Then — uid must be inside the [[extensions]] block (right after handle), not at
      // the top level of the file.
      const updatedContent = await readFile(tomlPath)
      expect(updatedContent).toBe(`api_version = "2026-07"

[[extensions]]
# Change the merchant-facing name of the extension in locales/en.default.json
name = "t:name"
handle = "app-home"
uid = "abc-123"
type = "ui_extension"

[[extensions.targeting]]
module = "./src/AppHome.jsx"
target = "admin.app.home.render"

[access_scopes]
scopes = "write_metaobject_definitions,write_metaobjects,write_products"
`)
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
