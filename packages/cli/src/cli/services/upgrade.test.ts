import {upgrade} from './upgrade.js'
import * as upgradeService from './upgrade.js'
import {afterEach, beforeEach, describe, expect, vi, test} from 'vitest'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import * as nodePackageManager from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortError} from '@shopify/cli-kit/node/error'

const oldCliVersion = '3.0.0'
// just needs to be higher than oldCliVersion for these tests
const currentCliVersion = '3.10.0'

vi.mock('@shopify/cli-kit/node/os', async () => {
  return {
    platformAndArch: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/system')

beforeEach(async () => {
  vi.mocked(platformAndArch).mockReturnValue({platform: 'windows', arch: 'amd64'})
})
afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('upgrade global CLI', () => {
  test('does not upgrade globally if the latest version is found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(undefined)

      // When
      await upgrade(tmpDir, currentCliVersion, {env: {}})

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })

  test('upgrades globally using npm if the latest version is not found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)

      // When
      await upgrade(tmpDir, oldCliVersion, {env: {}})

      // Then
      expect(vi.mocked(exec)).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', '@shopify/cli@latest', '@shopify/theme@latest'],
        {stdio: 'inherit'},
      )
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Upgrading CLI from ${oldCliVersion} to ${currentCliVersion}...\nAttempting to upgrade via \`npm install -g @shopify/cli@latest @shopify/theme@latest\`..."
      `)
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })

  const homebrewPackageNames = ['shopify-cli', 'shopify-cli@3']
  homebrewPackageNames.forEach((homebrewPackageName: string) => {
    test('upgrades globally using Homebrew if the latest version is not found and the CLI was installed via Homebrew', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(currentCliVersion)

        // Then
        await expect(async () => {
          await upgrade(tmpDir, oldCliVersion, {env: {SHOPIFY_HOMEBREW_FORMULA: homebrewPackageName}})
        }).rejects.toThrowError(AbortError)
      })
    })
  })
})

describe('upgrade local CLI', () => {
  test('throws an error if a valid app config file is missing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        writeFile(
          joinPath(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': currentCliVersion, '@shopify/app': currentCliVersion}}),
        ),
        touchFile(joinPath(tmpDir, 'shopify.wrongapp.toml')),
      ])
      const outputMock = mockAndCaptureOutput()
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValue(undefined)

      // When // Then
      await expect(upgrade(tmpDir, currentCliVersion, {env: {npm_config_user_agent: 'npm'}})).rejects.toBeInstanceOf(
        AbortError,
      )
    })
  })

  test('does not upgrade locally if the latest version is found', async () => {
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
      await upgrade(tmpDir, currentCliVersion, {env: {npm_config_user_agent: 'npm'}})

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })

  test('upgrades locally if the latest version is not found', async () => {
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
      vi.spyOn(nodePackageManager as any, 'checkForNewVersion').mockResolvedValueOnce(currentCliVersion)
      const addNPMDependenciesMock = vi
        .spyOn(nodePackageManager as any, 'addNPMDependencies')
        .mockResolvedValue(undefined)

      // When
      await upgradeService.upgrade(tmpDir, oldCliVersion, {env: {}})

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
          addToRootDirectory: false,
        },
      )
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })

  test('upgrades locally if CLI is on latest version but APP isnt', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await Promise.all([
        writeFile(
          joinPath(tmpDir, 'package.json'),
          JSON.stringify({dependencies: {'@shopify/cli': currentCliVersion, '@shopify/app': oldCliVersion}}),
        ),
        touchFile(joinPath(tmpDir, 'shopify.app.nondefault.toml')),
      ])
      const outputMock = mockAndCaptureOutput()
      const checkMock = vi.spyOn(nodePackageManager as any, 'checkForNewVersion')
      checkMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(currentCliVersion)
      const addNPMDependenciesMock = vi
        .spyOn(nodePackageManager as any, 'addNPMDependencies')
        .mockResolvedValue(undefined)

      // When
      await upgradeService.upgrade(tmpDir, oldCliVersion, {env: {}})

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
          addToRootDirectory: false,
        },
      )
      expect(outputMock.success()).toMatchInlineSnapshot(`
        "Upgraded Shopify CLI to version ${currentCliVersion}"
      `)
    })
  })
})
