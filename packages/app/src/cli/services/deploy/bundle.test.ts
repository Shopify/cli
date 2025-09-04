import {bundleAndBuildExtensions} from './bundle.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface, AppManifest} from '../../models/app/app.js'
import * as bundle from '../bundle.js'
import * as functionBuild from '../function/build.js'
import {describe, expect, test, vi} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('../function/build.js')

describe('bundleAndBuildExtensions', () => {
  let app: AppInterface
  let appManifest: AppManifest

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
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: false,
        isDevDashboardApp: false,
      })

      // Then
      expect(extensionBundleMock).toHaveBeenCalledTimes(2)
      expect(bundle.writeManifestToBundle).toHaveBeenCalledWith(appManifest, bundleDirectory)

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
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: false,
        isDevDashboardApp: false,
      })

      // Then
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('skips building extensions if skipBuild is true', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const functionExtension = await testFunctionExtension()
      const extensionBuildMock = vi.fn()
      const extensionCopyIntoBundleMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = extensionBuildMock
      functionExtension.copyIntoBundle = extensionCopyIntoBundleMock
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
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: true,
        isDevDashboardApp: false,
      })

      // Then
      expect(extensionBuildMock).not.toHaveBeenCalled()
      expect(extensionCopyIntoBundleMock).toHaveBeenCalledTimes(1)
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('skips installing Javy for function extensions when skipBuild is true', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      const mockInstallJavy = vi.mocked(functionBuild.installJavy)

      const functionExtension = await testFunctionExtension()
      const extensionCopyIntoBundleMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.copyIntoBundle = extensionCopyIntoBundleMock
      const app = testApp({allExtensions: [functionExtension], directory: tmpDir})

      const identifiers = {
        app: 'app-id',
        extensions: {[functionExtension.localIdentifier]: functionExtension.localIdentifier},
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: true,
        isDevDashboardApp: false,
      })

      // Then
      expect(mockInstallJavy).not.toHaveBeenCalled()
    })
  })

  test('installs Javy for function extensions when skipBuild is false', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      const mockInstallJavy = vi.mocked(functionBuild.installJavy)

      const functionExtension = await testFunctionExtension()
      const extensionBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = extensionBuildMock
      const app = testApp({allExtensions: [functionExtension], directory: tmpDir})

      const identifiers = {
        app: 'app-id',
        extensions: {[functionExtension.localIdentifier]: functionExtension.localIdentifier},
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: false,
        isDevDashboardApp: false,
      })

      // Then
      expect(mockInstallJavy).toHaveBeenCalledWith(app)
    })
  })

  test('handles theme extensions correctly with skipBuild', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const themeExtension = await testThemeExtensions()
      const extensionBuildMock = vi.fn()
      const extensionCopyIntoBundleMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        // Theme extensions would typically copy theme files here
        const themeDir = joinPath(bundleDirectory, themeExtension.uid)
        await file.mkdir(themeDir)
        file.writeFileSync(joinPath(themeDir, 'theme-file.liquid'), '<h1>Theme</h1>')
      })
      themeExtension.buildForBundle = extensionBuildMock
      themeExtension.copyIntoBundle = extensionCopyIntoBundleMock

      const app = testApp({allExtensions: [themeExtension], directory: tmpDir})

      const identifiers = {
        app: 'app-id',
        extensions: {[themeExtension.localIdentifier]: themeExtension.localIdentifier},
        extensionIds: {},
        extensionsNonUuidManaged: {},
      }
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: true,
        isDevDashboardApp: false,
      })

      // Then
      expect(extensionBuildMock).not.toHaveBeenCalled()
      expect(extensionCopyIntoBundleMock).toHaveBeenCalledTimes(1)
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('handles multiple extension types together', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      // Create different extension types
      const functionExtension = await testFunctionExtension()
      const themeExtension = await testThemeExtensions()
      const uiExtension = await testUIExtension({type: 'checkout_ui_extension'})

      // Set up mocks for each extension
      const functionBuildMock = vi.fn()
      const functionCopyMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = functionBuildMock
      functionExtension.copyIntoBundle = functionCopyMock

      const themeBuildMock = vi.fn()
      const themeCopyMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        const themeDir = joinPath(bundleDirectory, themeExtension.uid)
        await file.mkdir(themeDir)
        file.writeFileSync(joinPath(themeDir, 'theme.liquid'), '')
      })
      themeExtension.buildForBundle = themeBuildMock
      themeExtension.copyIntoBundle = themeCopyMock

      const uiBuildMock = vi.fn()
      const uiCopyMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        file.writeFileSync(joinPath(bundleDirectory, 'ui.js'), '')
      })
      uiExtension.buildForBundle = uiBuildMock
      uiExtension.copyIntoBundle = uiCopyMock

      const app = testApp({
        allExtensions: [functionExtension, themeExtension, uiExtension],
        directory: tmpDir,
      })

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
      appManifest = await app.manifest(identifiers)

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        identifiers,
        bundlePath,
        skipBuild: true,
        isDevDashboardApp: false,
      })

      // Then - verify none of the build methods were called
      expect(functionBuildMock).not.toHaveBeenCalled()
      expect(themeBuildMock).not.toHaveBeenCalled()
      expect(uiBuildMock).not.toHaveBeenCalled()

      // Verify all copy methods were called
      expect(functionCopyMock).toHaveBeenCalledTimes(1)
      expect(themeCopyMock).toHaveBeenCalledTimes(1)
      expect(uiCopyMock).toHaveBeenCalledTimes(1)

      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })
})
