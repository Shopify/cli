import {bundleAndBuildExtensions} from './bundle.js'
import {
  testApp,
  testAppConfigExtensions,
  testFunctionExtension,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
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

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: false,
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

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: false,
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
      const extensionBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = extensionBuildMock
      const app = testApp({allExtensions: [functionExtension], directory: tmpDir})

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: true,
      })

      // Then
      expect(extensionBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )
      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('skips installing Javy for function extensions when skipBuild is true', async () => {
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

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: true,
      })

      // Then
      expect(mockInstallJavy).not.toHaveBeenCalled()
      expect(extensionBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )
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

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: false,
      })

      // Then
      expect(mockInstallJavy).toHaveBeenCalledWith(app)
    })
  })

  test('passes skipBuild to theme extensions', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')

      const themeExtension = await testThemeExtensions()
      const extensionBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory, identifiers) => {
        const themeDir = joinPath(bundleDirectory, themeExtension.uid)
        await file.mkdir(themeDir)
        file.writeFileSync(joinPath(themeDir, 'theme-file.liquid'), '<h1>Theme</h1>')
      })
      themeExtension.buildForBundle = extensionBuildMock

      const app = testApp({allExtensions: [themeExtension], directory: tmpDir})

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: true,
      })

      // Then
      expect(extensionBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )
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

      const functionBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        file.writeFileSync(joinPath(bundleDirectory, 'index.wasm'), '')
      })
      functionExtension.buildForBundle = functionBuildMock

      const themeBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        const themeDir = joinPath(bundleDirectory, themeExtension.uid)
        await file.mkdir(themeDir)
        file.writeFileSync(joinPath(themeDir, 'theme.liquid'), '')
      })
      themeExtension.buildForBundle = themeBuildMock

      const uiBuildMock = vi.fn().mockImplementation(async (options, bundleDirectory) => {
        file.writeFileSync(joinPath(bundleDirectory, 'ui.js'), '')
      })
      uiExtension.buildForBundle = uiBuildMock

      const app = testApp({
        allExtensions: [functionExtension, themeExtension, uiExtension],
        directory: tmpDir,
      })

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: true,
      })

      expect(functionBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )
      expect(themeBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )
      expect(uiBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({app, environment: 'production', skipBuild: true}),
        joinPath(tmpDir, '.shopify', 'deploy-bundle'),
      )

      await expect(file.fileExists(bundlePath)).resolves.toBeTruthy()
    })
  })

  test('returns undefined and skips compression when no extension has deploy steps', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const bundlePath = joinPath(tmpDir, '.shopify', 'deploy-bundle.zip')
      const compressSpy = vi.spyOn(bundle, 'compressBundle').mockResolvedValue()

      const configExtension = await testAppConfigExtensions()
      const app = testApp({allExtensions: [configExtension], directory: tmpDir})

      appManifest = await app.manifest(appModuleUuidsFor(app))

      // When
      const result = await bundleAndBuildExtensions({
        app,
        appManifest,
        bundlePath,
        skipBuild: false,
      })

      // Then
      expect(result).toBeUndefined()
      expect(compressSpy).not.toHaveBeenCalled()
      await expect(file.fileExists(bundlePath)).resolves.toBe(false)
    })
  })
})

function appModuleUuidsFor(app: AppInterface) {
  return Object.fromEntries(
    app.allExtensions.map((extension) => [extension.localIdentifier, extension.localIdentifier]),
  )
}
