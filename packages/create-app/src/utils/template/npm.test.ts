import {getDeepInstallNPMTasks, updateCLIDependencies} from './npm.js'
import {describe, expect, vi, test} from 'vitest'
import {installNodeModules, PackageJson, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory, normalizePath} from '@shopify/cli-kit/node/path'
import {platform} from 'os'

vi.mock('os')
vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '1.2.3'}))

describe('updateCLIDependencies', () => {
  test('updates @shopify/cli and deletes @shopify/app if not using global CLI', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory, useGlobalCLI: false})

    expect(mockPackageJSON.dependencies!['@shopify/cli']).toBe('1.2.3')
    expect(mockPackageJSON.dependencies!['@shopify/app']).toBeUndefined()
  })

  test('removes @shopify/cli and @shopify/app if using global CLI', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory, useGlobalCLI: true})

    expect(mockPackageJSON.dependencies!['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.dependencies!['@shopify/app']).toBeUndefined()
  })

  test('does not update overrides or resolutions if local is false', async () => {
    const mockPackageJSON = {overrides: {}, resolutions: {}} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory, useGlobalCLI: false})

    expect(mockPackageJSON.overrides!['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.overrides!['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.overrides!['@shopify/cli-kit']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/cli-kit']).toBeUndefined()
  })

  test('updates overrides for @shopify/cli if local is true', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory, useGlobalCLI: false})

    const dependencyOveride = mockPackageJSON.overrides!['@shopify/cli']!
    const dependencyPath = joinPath(dependencyOveride.replace('file:', ''), 'package.json')
    const dependencyJSON = JSON.parse(await readFile(dependencyPath))

    expect(dependencyJSON.name).toBe('@shopify/cli')
  })

  test('updates resolutions for @shopify/cli if local is true', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory, useGlobalCLI: false})

    const dependencyResolution = mockPackageJSON.resolutions!['@shopify/cli']!
    const dependencyPath = joinPath(dependencyResolution.replace('file:', ''), 'package.json')
    const dependencyJSON = JSON.parse(await readFile(dependencyPath))

    expect(dependencyJSON.name).toBe('@shopify/cli')
  })

  test('updates dependency for @shopify/cli if local is true', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory, useGlobalCLI: false})

    const dependencyResolution = mockPackageJSON.dependencies!['@shopify/cli']!
    const dependencyPath = joinPath(dependencyResolution.replace('file:', ''), 'package.json')
    const dependencyJSON = JSON.parse(await readFile(dependencyPath))

    expect(dependencyJSON.name).toBe('@shopify/cli')
  })

  test('does not change existing values', async () => {
    const mockPackageJSON = {
      name: '',
      author: '',
      scripts: {},
      dependencies: {
        mock: 'value',
      },
      devDependencies: {
        mock: 'value',
      },
      resolutions: {
        mock: 'value',
      },
      overrides: {
        mock: 'value',
      },
    }
    const directory = moduleDirectory(import.meta.url)
    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory, useGlobalCLI: false})

    expect(mockPackageJSON.dependencies.mock).toBe('value')
    expect(mockPackageJSON.overrides.mock).toBe('value')
    expect(mockPackageJSON.resolutions.mock).toBe('value')
  })
})

describe('getDeepInstallNPMTasks', () => {
  async function mockAppFolder(callback: (tmpDir: string) => Promise<void>) {
    await inTemporaryDirectory(async (tmpDir) => {
      await mkdir(joinPath(tmpDir, 'web'))
      await mkdir(joinPath(tmpDir, 'web', 'frontend'))
      await Promise.all([
        writeFile(joinPath(tmpDir, 'package.json'), '{}'),
        writeFile(joinPath(tmpDir, 'web', 'package.json'), '{}'),
        writeFile(joinPath(tmpDir, 'web', 'frontend', 'package.json'), '{}'),
      ])

      return callback(tmpDir)
    })
  }

  const defaultArgs: {packageManager: PackageManager; didInstallEverything: () => void} = {
    packageManager: 'npm',
    didInstallEverything: () => {},
  }

  test.each([['darwin'], ['win32']])('each task installs dependencies when the os is %s', async (operativeSystem) => {
    await mockAppFolder(async (tmpDir) => {
      const expectedArgs = operativeSystem === 'win32' ? ['--network-concurrency', '1'] : []
      vi.mocked(platform).mockReturnValue(operativeSystem as NodeJS.Platform)

      await getDeepInstallNPMTasks({...defaultArgs, packageManager: 'yarn', from: tmpDir})

      expect(installNodeModules).toHaveBeenCalledWith({
        directory: `${normalizePath(tmpDir)}`,
        packageManager: 'yarn',
        args: expectedArgs,
      })
    })
  })
})
