import {bundleAndBuildExtensions} from './bundle.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import * as bundle from '../bundle.js'
import {describe, expect, test, vi} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('bundleAndBuildExtensions', () => {
  let app: AppInterface

  test('generates a manifest.json', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(bundle, 'writeManifestToBundle').mockResolvedValue(undefined)
      const bundleDirectory = joinPath(tmpDir, '.shopify', 'deploy-bundle')
      const bundlePath = joinPath(bundleDirectory, 'bundle.zip')

      const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
      const extensionBundleMock = vi.fn()
      uiExtension.buildForBundle = extensionBundleMock
      const themeExtension = await testThemeExtensions()
      themeExtension.buildForBundle = extensionBundleMock
      app = testApp({allExtensions: [uiExtension, themeExtension], directory: tmpDir})

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
            assets: 'test-ui-extension-uid',
            target: '',
            config: {},
          },
          {
            type: 'theme_external',
            handle: 'theme-extension-name',
            uid: themeExtension.uid,
            assets: themeExtension.uid,
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
      await bundleAndBuildExtensions({app, identifiers, bundlePath})

      // Then
      expect(extensionBundleMock).toHaveBeenCalledTimes(2)
      expect(bundle.writeManifestToBundle).toHaveBeenCalledWith(app, bundleDirectory)

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
      const app = testApp({allExtensions: [functionExtension], directory: tmpDir})

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
      await bundleAndBuildExtensions({app, identifiers, bundlePath})

      // Then
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })
})
