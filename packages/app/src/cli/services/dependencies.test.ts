import {installAppDependencies} from './dependencies.js'
import {AppInterface} from '../models/app/app.js'
import {testApp} from '../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {installNPMDependenciesRecursively} from '@shopify/cli-kit/node/node-package-manager'
import {renderTasks} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/node/ui')

describe('installAppDependencies', () => {
  test('installs dependencies recursively', async () => {
    // Given
    const app: AppInterface = testApp({updateDependencies: () => Promise.resolve()})

    // When
    await installAppDependencies(app)

    // Then
    expect(vi.mocked(renderTasks).mock.calls.length).toEqual(1)
    const tasks = vi.mocked(renderTasks).mock.calls[0]![0] as any
    expect(tasks.length).toEqual(1)
    const task = tasks[0]
    expect(task.title).not.toBe('')
    await task.task()
    expect(installNPMDependenciesRecursively).toHaveBeenCalledWith({
      packageManager: 'yarn',
      directory: '/tmp/project',
      deep: 3,
    })
  })
})
