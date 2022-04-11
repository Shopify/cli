import getDeepInstallNPMTasks from './npm'
import {dependency, file, path, ui} from '@shopify/cli-kit'
import {describe, expect, it, vi} from 'vitest'
import {temporary} from '@shopify/cli-testing'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: {[key: string]: any} = await vi.importActual('@shopify/cli-kit')

  return {
    ...cliKit,
    dependency: {
      ...cliKit.dependency,
      install: vi.fn(),
    },
  }
})

describe('dependencies', () => {
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
