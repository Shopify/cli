import {upgrade} from './upgrade.js'
import * as upgradeService from './upgrade.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {file, os, outputMocker, path, system} from '@shopify/cli-kit'
import * as nodePackageManager from '@shopify/cli-kit/node/node-package-manager'

const oldCliVersion = '3.0.0'
// just needs to be higher than oldCliVersion for these tests
const currentCliVersion = '3.10.0'

const OLD_ENV = {...process.env}

beforeEach(async () => {
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
        exec: vi.fn(),
      },
    }
  })
  vi.mocked(os.platformAndArch).mockReturnValue({platform: 'win32', arch: 'amd64'})
})
afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
  process.env = {...OLD_ENV}
})

describe('upgrade global CLI', () => {
  beforeEach(() => {
    process.env = {...OLD_ENV, npm_config_user_agent: undefined}
  })

  it('does not upgrade globally if the latest version is found', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(undefined)

      // When
      await upgrade(tmpDir, currentCliVersion)

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })

  it('upgrades globally using npm if the latest version is not found', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)

      // When
      await upgrade(tmpDir, oldCliVersion)

      // Then
      expect(vi.mocked(system.exec)).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', '@shopify/cli@latest', '@shopify/theme@latest'],
        {stdio: 'inherit'},
      )
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}...\nAttempting to upgrade via npm install -g @shopify/cli@latest @shopify/theme@latest..."
      `)
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })

  const homebrewPackageNames = ['shopify-cli', 'shopify-cli@3']
  homebrewPackageNames.forEach((homebrewPackageName: string) => {
    it('upgrades globally using Homebrew if the latest version is not found and the CLI was installed via Homebrew', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const outputMock = outputMocker.mockAndCaptureOutput()
        vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)
        process.env.SHOPIFY_HOMEBREW_FORMULA = homebrewPackageName

        // When
        await upgrade(tmpDir, oldCliVersion)

        // Then
        expect(vi.mocked(system.exec)).toHaveBeenCalledWith('brew', ['upgrade', homebrewPackageName], {
          stdio: 'inherit',
        })
        expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}...\nHomebrew installation detected. Attempting to upgrade via brew upgrade..."
      `)
        expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
      })
    })
  })
})

describe('upgrade local CLI', () => {
  beforeEach(() => {
    process.env = {...OLD_ENV, npm_config_user_agent: 'npm'}
  })

  it('does not upgrade locally if the latest version is found', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        file.write(
          path.join(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': currentCliVersion, '@shopify/app': currentCliVersion}}),
        ),
        file.touch(path.join(tmpDir, 'shopify.app.toml')),
      ])
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(undefined)

      // When
      await upgrade(tmpDir, currentCliVersion)

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })

  it('upgrades locally if the latest version is not found', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        file.write(
          path.join(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': oldCliVersion, '@shopify/app': oldCliVersion}}),
        ),
        file.touch(path.join(tmpDir, 'shopify.app.toml')),
      ])
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)
      const addNPMDependenciesMock = vi
        .spyOn(nodePackageManager as any, 'addNPMDependencies')
        .mockResolvedValue(undefined)

      // When
      await upgradeService.upgrade(tmpDir, oldCliVersion)

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}..."
      `)
      expect(addNPMDependenciesMock).toHaveBeenCalledWith(
        [
          {name: '@shopify/cli', version: 'latest'},
          {name: '@shopify/app', version: 'latest'},
        ],
        {
          packageManager: 'npm',
          type: 'prod',
          directory: path.normalize(tmpDir),
          stdout: process.stdout,
          stderr: process.stderr,
        },
      )
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })
})
