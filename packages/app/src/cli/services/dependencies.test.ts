import {installAppDependencies} from './dependencies.js'
import {AppInterface} from '../models/app/app.js'
import {testApp} from '../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {ui} from '@shopify/cli-kit'
import {installNPMDependenciesRecursively} from '@shopify/cli-kit/node/node-package-manager'

beforeEach(() => {
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
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('installAppDependencies', () => {
  test('installs dependencies recursively', async () => {
    // Given
    const app: AppInterface = testApp({updateDependencies: () => Promise.resolve()})
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
    expect(installNPMDependenciesRecursively).toHaveBeenCalledWith({
      packageManager: 'yarn',
      directory: '/tmp/project',
      deep: 3,
    })
  })
})
