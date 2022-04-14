import {getDeepInstallNPMTasks, updateCLIDependencies} from './npm'
import {constants, dependency, file, npm, path, ui} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Writable} from 'stream'

describe('updateCLIDependencies', () => {
  it('updates the @shopify/cli and @shopify/app dependency version', async () => {
    const mockPackageJSON = {} as npm.PackageJSON

    await updateCLIDependencies(mockPackageJSON, false)

    expect(mockPackageJSON.dependencies['@shopify/cli']).toBe(constants.versions.cli)
    expect(mockPackageJSON.dependencies['@shopify/app']).toBe(constants.versions.app)
  })

  it('does not update overrides or resolutions if local is false', async () => {
    const mockPackageJSON = {overrides: {}, resolutions: {}} as npm.PackageJSON

    await updateCLIDependencies(mockPackageJSON, false)

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

      await updateCLIDependencies(mockPackageJSON, true)

      const dependencyOveride = mockPackageJSON.overrides[dependency]
      const dependencyPath = path.join(dependencyOveride.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await file.read(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it.each(['@shopify/cli', '@shopify/app', '@shopify/cli-kit'])(
    'updates resolutions for %s if local is true',
    async (dependency) => {
      const mockPackageJSON = {} as npm.PackageJSON

      await updateCLIDependencies(mockPackageJSON, true)

      const dependencyResolution = mockPackageJSON.resolutions[dependency]
      const dependencyPath = path.join(dependencyResolution.replace('file:', ''), 'package.json')
      const dependencyJSON = JSON.parse(await file.read(dependencyPath))

      expect(dependencyJSON.name).toBe(dependency)
    },
  )

  it('does not change existing values', async () => {
    const mockPackageJSON = {
      name: '',
      author: '',
      dependencies: {
        mock: 'value',
      },
      resolutions: {
        mock: 'value',
      },
      overrides: {
        mock: 'value',
      },
    }
    await updateCLIDependencies(mockPackageJSON, false)

    expect(mockPackageJSON.dependencies.mock).toBe('value')
    expect(mockPackageJSON.overrides.mock).toBe('value')
    expect(mockPackageJSON.resolutions.mock).toBe('value')
  })
})

describe('getDeepInstallNPMTasks', () => {
  async function mockAppFolder(callback: (tmpDir: string) => Promise<void>) {
    await temporary.directory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'home'))
      await file.mkdir(path.join(tmpDir, 'home', 'frontend'))
      await Promise.all([
        file.write(path.join(tmpDir, 'package.json'), '{}'),
        file.write(path.join(tmpDir, 'home', 'package.json'), '{}'),
        file.write(path.join(tmpDir, 'home', 'frontend', 'package.json'), '{}'),
      ])

      callback(tmpDir)
    })
  }

  const defaultArgs = {
    dependencyManager: dependency.DependencyManager.Npm,
    didInstallEverything: () => {},
  }

  beforeEach(() => {
    vi.spyOn(dependency, 'install').mockImplementation(async () => undefined)
  })

  it.each([
    ['/', 0],
    ['/home/', 1],
    ['/home/frontend/', 2],
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

  it('each task.task installs dependencies', async () => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})

      await Promise.all(tasks.map(({task}) => task(null, {} as ui.ListrTaskWrapper<any, any>)))

      expect(dependency.install).toHaveBeenCalledWith(
        `${tmpDir}/`,
        defaultArgs.dependencyManager,
        expect.any(Writable),
        expect.any(Writable),
      )
      expect(dependency.install).toHaveBeenCalledWith(
        `${path.join(tmpDir, 'home')}/`,
        defaultArgs.dependencyManager,
        expect.any(Writable),
        expect.any(Writable),
      )
      expect(dependency.install).toHaveBeenCalledWith(
        `${path.join(tmpDir, 'home', 'frontend')}/`,
        defaultArgs.dependencyManager,
        expect.any(Writable),
        expect.any(Writable),
      )
    })
  })

  it('each task updates its title once dependencies are installed', async () => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})
      const taskStates = [{title: ''}, {title: ''}, {title: ''}] as ui.ListrTaskWrapper<any, any>[]

      await Promise.all(tasks.map(({task}, i) => task(null, taskStates[i])))

      expect(taskStates).toContainEqual({title: `Installed dependencies in /`})
      expect(taskStates).toContainEqual({title: `Installed dependencies in /home/`})
      expect(taskStates).toContainEqual({title: `Installed dependencies in /home/frontend/`})
    })
  })

  it('calls didInstallEverything() once all folders are installed', async () => {
    await mockAppFolder(async (tmpDir) => {
      const didInstallEverything = vi.fn()
      const taskState = {output: ''} as ui.ListrTaskWrapper<any, any>
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir, didInstallEverything})

      await tasks[0].task(null, taskState)
      await tasks[1].task(null, taskState)

      expect(didInstallEverything).not.toHaveBeenCalled()

      await tasks[2].task(null, taskState)

      expect(didInstallEverything).toHaveBeenCalled()
    })
  })

  it('each task updates its output with the stdout from installing dependencies', async () => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})
      const taskStates = [{output: ''}, {output: ''}, {output: ''}] as ui.ListrTaskWrapper<any, any>[]

      await Promise.all(tasks.map(({task}, i) => task(null, taskStates[i])))

      const install = vi.mocked(dependency.install)

      install.mock.calls.forEach((args, i) => {
        const stdout = args[2]

        stdout!.write(`stdout ${i}`)
      })

      expect(taskStates).toContainEqual(expect.objectContaining({output: `stdout 0`}))
      expect(taskStates).toContainEqual(expect.objectContaining({output: `stdout 1`}))
      expect(taskStates).toContainEqual(expect.objectContaining({output: `stdout 2`}))
    })
  })

  it('each task updates its output with the stderr from installing dependencies', async () => {
    await mockAppFolder(async (tmpDir) => {
      const tasks = await getDeepInstallNPMTasks({...defaultArgs, from: tmpDir})
      const taskStates = [{output: ''}, {output: ''}, {output: ''}] as ui.ListrTaskWrapper<any, any>[]

      await Promise.all(tasks.map(({task}, i) => task(null, taskStates[i])))

      const install = vi.mocked(dependency.install)

      install.mock.calls.forEach((args, i) => {
        const stderr = args[3]

        stderr!.write(`stderr ${i}`)
      })

      expect(taskStates).toContainEqual(expect.objectContaining({output: `stderr 0`}))
      expect(taskStates).toContainEqual(expect.objectContaining({output: `stderr 1`}))
      expect(taskStates).toContainEqual(expect.objectContaining({output: `stderr 2`}))
    })
  })
})
