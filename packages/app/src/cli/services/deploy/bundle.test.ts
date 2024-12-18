import {bundleAndBuildExtensions} from './bundle.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {describe, expect, test, vi} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('bundleAndBuildExtensions', () => {
  let app: AppInterface

  test('generates a manifest.json when App Management is enabled', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(file, 'writeFileSync').mockResolvedValue(undefined)
      const envVars = {USE_APP_MANAGEMENT_API: 'true'}
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
      const extensionBundleMock = vi.fn()
      uiExtension.buildForBundle = extensionBundleMock
      const themeExtension = await testThemeExtensions()
      themeExtension.buildForBundle = extensionBundleMock
      app = testApp({allExtensions: [uiExtension, themeExtension]})

      const extensions: {[key: string]: string} = {}
      for (const extension of app.allExtensions) {
        extensions[extension.localIdentifier] = extension.localIdentifier
      }
      const identifiers = {
        app: 'app-id',
        extensions,
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }
      const expectedManifest = {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'web_pixel_extension_external',
            handle: 'test-ui-extension',
            uid: 'test-ui-extension-uid',
            assets: 'test-ui-extension',
            target: '',
            config: {},
          },
          {
            type: 'theme_external',
            handle: 'theme-extension-name',
            uid: themeExtension.uid,
            assets: 'theme-extension-name',
            target: '',
            config: {
              theme_extension: {
                files: {},
              },
            },
          },
        ],
      }

      // When
      await bundleAndBuildExtensions({app, identifiers, bundlePath}, envVars)

      // Then
      expect(extensionBundleMock).toHaveBeenCalledTimes(2)
      expect(file.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        JSON.stringify(expectedManifest, null, 2),
      )

      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('does not generate the manifest.json when App Management is disabled', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(file, 'writeFileSync').mockResolvedValue(undefined)
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
      const extensionBundleMock = vi.fn()
      uiExtension.buildForBundle = extensionBundleMock
      const themeExtension = await testThemeExtensions()
      themeExtension.buildForBundle = extensionBundleMock
      app = testApp({allExtensions: [uiExtension, themeExtension]})

      const extensions: {[key: string]: string} = {}
      for (const extension of app.allExtensions) {
        extensions[extension.localIdentifier] = extension.localIdentifier
      }
      const identifiers = {
        app: 'app-id',
        extensions,
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }

      // When
      await bundleAndBuildExtensions({app, identifiers, bundlePath}, {})

      // Then
      expect(extensionBundleMock).toHaveBeenCalledTimes(2)
      expect(file.writeFileSync).not.toHaveBeenCalled()

      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('creates a zip file for a function extension', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const functionExtension = await testFunctionExtension()
      const extensionBundleMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = extensionBundleMock
      const app = testApp({allExtensions: [functionExtension]})

      const extensions: {[key: string]: string} = {}
      for (const extension of app.allExtensions) {
        extensions[extension.localIdentifier] = extension.localIdentifier
      }
      const identifiers = {
        app: 'app-id',
        extensions,
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }

      // When
      await bundleAndBuildExtensions({app, identifiers, bundlePath}, {})

      // Then
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })
})
