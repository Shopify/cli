import {getDeepInstallNPMTasks, updateCLIDependencies} from './npm.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {installNodeModules, PackageJson, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory, normalizePath} from '@shopify/cli-kit/node/path'
import {platform} from 'os'

beforeEach(async () => {
  vi.mock('os')
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '1.2.3'}))
})

describe('updateCLIDependencies', () => {
  it('updates the @shopify/cli and @shopify/app dependency version', async () => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

    expect(mockPackageJSON.dependencies!['@shopify/cli']).toBe('1.2.3')
    expect(mockPackageJSON.dependencies!['@shopify/app']).toBe('1.2.3')
  })

  it('does not update overrides or resolutions if local is false', async () => {
    const mockPackageJSON = {overrides: {}, resolutions: {}} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

    expect(mockPackageJSON.overrides!['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.overrides!['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.overrides!['@shopify/cli-kit']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.resolutions!['@shopify/cli-kit']).toBeUndefined()
  })

  it.each(['@shopify/cli', '@shopify/app', '@shopify/cli-kit'])(
    'updates overrides for %s if local is true',
    async (dependency) => {
      const mockPackageJSON = {} as PackageJson
      const directory = moduleDirectory(import.meta.url)

      await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

      const dependencyOveride = mockPackageJSON.overrides![dependency]!
      const dependencyPath = joinPath(dependencyOveride.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await readFile(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it.each(['@shopify/cli', '@shopify/app', '@shopify/cli-kit'])(
    'updates resolutions for %s if local is true',
    async (dependency) => {
      const mockPackageJSON = {} as PackageJson
      const directory = moduleDirectory(import.meta.url)

      await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

      const dependencyResolution = mockPackageJSON.resolutions![dependency]!
      const dependencyPath = joinPath(dependencyResolution.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await readFile(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it.each(['@shopify/cli', '@shopify/app'])('updates dependency for %s if local is true', async (dependency) => {
    const mockPackageJSON = {} as PackageJson
    const directory = moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

    const dependencyResolution = mockPackageJSON.dependencies![dependency]!
    const dependencyPath = joinPath(dependencyResolution.replace('file:', ''), 'package.json')
    const dependencyJSON = JSON.parse(await readFile(dependencyPath))

    expect(dependencyJSON.name).toBe(dependency)
  })

  it('does not change existing values', async () => {
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
    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

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

  it('returns a task for each folder with a package.json', async () => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})

      expect(tasks).toStrictEqual([
        {
          title: `Installing dependencies`,
          task: expect.any(Function),
        },
        {
          title: `Installing dependencies in web/`,
          task: expect.any(Function),
        },
        {
          title: `Installing dependencies in web/frontend/`,
          task: expect.any(Function),
        },
      ])
    })
  })

  it.each([['darwin'], ['win32']])('each task installs dependencies when the os is %s', async (operativeSystem) => {
    await mockAppFolder(async (tmpDir) => {
      const expectedArgs = operativeSystem === 'win32' ? ['--network-concurrency', '1'] : []
      vi.mocked(platform).mockReturnValue(operativeSystem as NodeJS.Platform)

      const tasks = await getDeepInstallNPMTasks({...defaultArgs, packageManager: 'yarn', from: tmpDir})

      await Promise.all(tasks.map(({task}) => task({})))

      expect(installNodeModules).toHaveBeenCalledWith({
        directory: `${normalizePath(tmpDir)}/`,
        packageManager: 'yarn',
        args: expectedArgs,
      })
      expect(installNodeModules).toHaveBeenCalledWith({
        directory: `${joinPath(tmpDir, 'web')}/`,
        packageManager: 'yarn',
        args: expectedArgs,
      })
      expect(installNodeModules).toHaveBeenCalledWith({
        directory: `${joinPath(tmpDir, 'web', 'frontend')}/`,
        packageManager: 'yarn',
        args: expectedArgs,
      })
    })
  })
})
