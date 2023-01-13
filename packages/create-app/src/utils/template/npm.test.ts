import {getDeepInstallNPMTasks, updateCLIDependencies} from './npm.js'
import {file, npm, path} from '@shopify/cli-kit'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {installNodeModules, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {platform} from 'os'

beforeEach(async () => {
  vi.mock('os')
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      constants: {
        versions: {
          cliKit: () => '1.2.3',
        },
      },
    }
  })
})

describe('updateCLIDependencies', () => {
  it('updates the @shopify/cli and @shopify/app dependency version', async () => {
    const mockPackageJSON = {} as npm.PackageJSON
    const directory = path.moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

    expect(mockPackageJSON.dependencies['@shopify/cli']).toBe('1.2.3')
    expect(mockPackageJSON.dependencies['@shopify/app']).toBe('1.2.3')
  })

  it('does not update overrides or resolutions if local is false', async () => {
    const mockPackageJSON = {overrides: {}, resolutions: {}} as npm.PackageJSON
    const directory = path.moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

    expect(mockPackageJSON.overrides['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.overrides['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.overrides['@shopify/cli-kit']).toBeUndefined()
    expect(mockPackageJSON.resolutions['@shopify/cli']).toBeUndefined()
    expect(mockPackageJSON.resolutions['@shopify/app']).toBeUndefined()
    expect(mockPackageJSON.resolutions['@shopify/cli-kit']).toBeUndefined()
  })

  it.each(['@shopify/cli', '@shopify/app', '@shopify/cli-kit'])(
    'updates overrides for %s if local is true',
    async (dependency) => {
      const mockPackageJSON = {} as npm.PackageJSON
      const directory = path.moduleDirectory(import.meta.url)

      await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

      const dependencyOveride = mockPackageJSON.overrides[dependency]!
      const dependencyPath = path.join(dependencyOveride.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await file.read(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it.each(['@shopify/cli', '@shopify/app', '@shopify/cli-kit'])(
    'updates resolutions for %s if local is true',
    async (dependency) => {
      const mockPackageJSON = {} as npm.PackageJSON
      const directory = path.moduleDirectory(import.meta.url)

      await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

      const dependencyResolution = mockPackageJSON.resolutions[dependency]!
      const dependencyPath = path.join(dependencyResolution.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await file.read(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it.each(['@shopify/cli', '@shopify/app'])('updates dependency for %s if local is true', async (dependency) => {
    const mockPackageJSON = {} as npm.PackageJSON
    const directory = path.moduleDirectory(import.meta.url)

    await updateCLIDependencies({packageJSON: mockPackageJSON, local: true, directory})

    const dependencyResolution = mockPackageJSON.dependencies[dependency]!
    const dependencyPath = path.join(dependencyResolution.replace('file:', ''), 'package.json')
    const dependencyJSON = JSON.parse(await file.read(dependencyPath))

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
    const directory = path.moduleDirectory(import.meta.url)
    await updateCLIDependencies({packageJSON: mockPackageJSON, local: false, directory})

    expect(mockPackageJSON.dependencies.mock).toBe('value')
    expect(mockPackageJSON.overrides.mock).toBe('value')
    expect(mockPackageJSON.resolutions.mock).toBe('value')
  })
})

describe('getDeepInstallNPMTasks', () => {
  async function mockAppFolder(callback: (tmpDir: string) => Promise<void>) {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'web'))
      await file.mkdir(path.join(tmpDir, 'web', 'frontend'))
      await Promise.all([
        file.write(path.join(tmpDir, 'package.json'), '{}'),
        file.write(path.join(tmpDir, 'web', 'package.json'), '{}'),
        file.write(path.join(tmpDir, 'web', 'frontend', 'package.json'), '{}'),
      ])

      return callback(tmpDir)
    })
  }

  const defaultArgs: {packageManager: PackageManager; didInstallEverything: () => void} = {
    packageManager: 'npm',
    didInstallEverything: () => {},
  }

  it.each([
    ['/', 0],
    ['/web/', 1],
    ['/web/frontend/', 2],
  ])('returns a task for %s', async (folderPath, i) => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})
      const thisTask = tasks[i]

      expect(thisTask).toStrictEqual({
        title: `Installing dependencies in ${folderPath}`,
        task: expect.any(Function),
      })
    })
  })

  it.each([['darwin'], ['win32']])(
    'each task.task installs dependencies when the os is %s',
    async (operativeSystem) => {
      await mockAppFolder(async (tmpDir) => {
        const expectedArgs = operativeSystem === 'win32' ? ['--network-concurrency', '1'] : []
        vi.mocked(platform).mockReturnValue(operativeSystem as NodeJS.Platform)

        const tasks = await getDeepInstallNPMTasks({...defaultArgs, packageManager: 'yarn', from: tmpDir})

        await Promise.all(tasks.map(({task}) => task({})))

        expect(installNodeModules).toHaveBeenCalledWith({
          directory: `${path.normalize(tmpDir)}/`,
          packageManager: 'yarn',
          args: expectedArgs,
        })
        expect(installNodeModules).toHaveBeenCalledWith({
          directory: `${path.join(tmpDir, 'web')}/`,
          packageManager: 'yarn',
          args: expectedArgs,
        })
        expect(installNodeModules).toHaveBeenCalledWith({
          directory: `${path.join(tmpDir, 'web', 'frontend')}/`,
          packageManager: 'yarn',
          args: expectedArgs,
        })
      })
    },
  )
})
