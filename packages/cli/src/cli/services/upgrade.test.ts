import {upgrade} from './upgrade.js'
import * as upgradeService from './upgrade.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import * as nodePackageManager from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

const oldCliVersion = '3.0.0'
// just needs to be higher than oldCliVersion for these tests
const currentCliVersion = '3.10.0'

const OLD_ENV = {...process.env}

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/os', async () => {
    return {
      platformAndArch: vi.fn(),
    }
  })
  vi.mock('@shopify/cli-kit/node/system')
  vi.mocked(platformAndArch).mockReturnValue({platform: 'windows', arch: 'amd64'})
})
afterEach(() => {
  mockAndCaptureOutput().clear()
  process.env = {...OLD_ENV}
})

describe('upgrade global CLI', () => {
  beforeEach(() => {
    process.env = {...OLD_ENV, npm_config_user_agent: undefined}
  })

  it('does not upgrade globally if the latest version is found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)

      // When
      await upgrade(tmpDir, oldCliVersion)

      // Then
      expect(vi.mocked(exec)).toHaveBeenCalledWith(
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
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const outputMock = mockAndCaptureOutput()
        vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)
        process.env.SHOPIFY_HOMEBREW_FORMULA = homebrewPackageName

        // When
        await upgrade(tmpDir, oldCliVersion)

        // Then
        expect(vi.mocked(exec)).toHaveBeenCalledWith('brew', ['upgrade', homebrewPackageName], {
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        writeFile(
          joinPath(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': currentCliVersion, '@shopify/app': currentCliVersion}}),
        ),
        touchFile(joinPath(tmpDir, 'shopify.app.toml')),
      ])
      const outputMock = mockAndCaptureOutput()
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        writeFile(
          joinPath(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': oldCliVersion, '@shopify/app': oldCliVersion}}),
        ),
        touchFile(joinPath(tmpDir, 'shopify.app.toml')),
      ])
      const outputMock = mockAndCaptureOutput()
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
          directory: normalizePath(tmpDir),
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
