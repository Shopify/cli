import {installAppDependencies} from './dependencies'
import {App} from '../models/app/app'
import {describe, expect, test, vi} from 'vitest'
import {dependency, ui} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    ui: {
      Listr: vi.fn(),
    },
    dependency: {
      updateDependencies: (app: App) => app,
    },
  }
})

describe('installAppDependencies', () => {
  test('installs dependencies recursively', async () => {
    // Given
    const app: App = {
      configuration: {
        name: 'App',
        scopes: '',
      },
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      extensions: {
        ui: [],
        function: [],
        theme: [],
      },
      webs: [],
      nodeDependencies: {},
      configurationPath: '/tmp/project/shopify.app.toml',
    }
    const listRun = vi.fn().mockResolvedValue(undefined)
    const list: any = {run: listRun}
    vi.mocked(ui.Listr).mockReturnValue(list)

    // When
    await installAppDependencies(app)

    // Then
    expect(vi.mocked(ui.Listr).mock.calls.length).toEqual(1)
    const tasks = vi.mocked(ui.Listr).mock.calls[0][0] as any
    expect(tasks.length).toEqual(1)
    const task = tasks[0]
    expect(task.title).not.toBe('')
    await task.task(undefined, {title: vi.fn()})
    expect(listRun).toHaveBeenCalled()
    expect(dependency.installNPMDependenciesRecursively).toHaveBeenCalledWith({
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      deep: 3,
    })
  })
})
