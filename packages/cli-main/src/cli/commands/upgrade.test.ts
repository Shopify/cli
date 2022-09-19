import Upgrade from './upgrade'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {constants, file, os, outputMocker, path, system} from '@shopify/cli-kit'
// import {
  // checkForNewVersion,
// } from '@shopify/cli-kit/node/node-package-manager'

const oldCliVersion = '3.0.0'

beforeEach(async () => {
  vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(await constants.versions.cliKit())
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      output: {
        ...module.output,
        getOutputUpdateCLIReminder: vi.fn(),
      },
      os: {
        ...module.os,
        platformAndArch: vi.fn(),
      },
      system: {
        ...module.system,
        captureOutput: vi.fn(),
        exec: vi.fn(),
      }
    }
  })
  vi.mocked(os.platformAndArch).mockReturnValue({platform: 'win32', arch: 'amd64'})
})
afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
})

describe('upgrade global CLI', () => {
  it('does not upgrade globally if the latest version is found', async () => {
    const currentCliVersion = await constants.versions.cliKit()
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(Upgrade.prototype as any, 'parse').mockResolvedValue({flags: {path: tmpDir}})
      vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(currentCliVersion)
      vi.spyOn(Upgrade.prototype as any, 'usingPackageManager').mockReturnValue(false)

      // When
      await Upgrade.run()

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })

  it('upgrades globally using npm if the latest version is not found', async () => {
    const currentCliVersion = await constants.versions.cliKit()
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(Upgrade.prototype as any, 'parse').mockResolvedValue({flags: {path: tmpDir}})
      vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(oldCliVersion)
      vi.spyOn(Upgrade.prototype as any, 'usingPackageManager').mockReturnValue(false)

      // When
      await Upgrade.run()

      // Then
      expect(vi.mocked(system.exec)).toHaveBeenCalledWith(
        'npm',
        [
          "install",
          "-g",
          "@shopify/cli",
          "@shopify/theme",
        ],
        {stdio: 'inherit'}
      )
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}...\nAttempting to upgrade via npm install -g @shopify/cli @shopify/theme..."
      `)
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })

  it('upgrades globally using Homebrew if the latest version is not found and the CLI was installed via Homebrew', async () => {
    const currentCliVersion = await constants.versions.cliKit()
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(Upgrade.prototype as any, 'parse').mockResolvedValue({flags: {path: tmpDir}})
      vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(oldCliVersion)
      vi.spyOn(Upgrade.prototype as any, 'usingPackageManager').mockReturnValue(false)
      vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'amd64'})
      const captureOutputSpy = vi.mocked(system.captureOutput)
      captureOutputSpy.mockResolvedValue('shopify-cli@3')

      // When
      await Upgrade.run()

      // Then
      expect(captureOutputSpy).toHaveBeenCalledWith('brew', ['list', '-1'])
      expect(vi.mocked(system.exec)).toHaveBeenCalledWith(
        'brew',
        [
          'upgrade',
          'shopify-cli@3',
        ],
        {stdio: 'inherit'}
      )
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}...\nHomebrew installation detected. Attempting to upgrade via brew upgrade..."
      `)
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })
})

describe('upgrade local CLI', () => {
  it('does not upgrade locally if the latest version is found', async () => {
    const currentCliVersion = await constants.versions.cliKit()
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await file.write(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({dependencies: {'@shopify/cli': currentCliVersion, '@shopify/app': currentCliVersion}}),
      )
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(Upgrade.prototype as any, 'parse').mockResolvedValue({flags: {path: tmpDir}})
      vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(currentCliVersion)
      vi.spyOn(Upgrade.prototype as any, 'usingPackageManager').mockReturnValue(false)

      // When
      await Upgrade.run()

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })
})
