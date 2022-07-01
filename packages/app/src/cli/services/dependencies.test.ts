import {installAppDependencies} from './dependencies.js'
import {App} from '../models/app/app.js'
import {describe, expect, test, vi} from 'vitest'
import {dependency, ui} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    ui: {
      newListr: vi.fn(),
    },
    dependency: {
      installNPMDependenciesRecursively: vi.fn(),
    },
  }
})

vi.mock('../models/app/app', async () => {
  const app: any = await vi.importActual('../models/app/app')
  return {
    ...app,
    updateDependencies: async (app: App) => app,
  }
})

describe('installAppDependencies', () => {
  test('installs dependencies recursively', async () => {
    // Given
    const app: App = {
      name: 'App',
      idEnvironmentVariableName: 'SHOPIFY_API_KEY',
      configuration: {
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
    vi.mocked(ui.newListr).mockReturnValue(list)

    // When
    await installAppDependencies(app)

    // Then
    expect(vi.mocked(ui.newListr).mock.calls.length).toEqual(1)
    const tasks = vi.mocked(ui.newListr).mock.calls[0][0] as any
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
