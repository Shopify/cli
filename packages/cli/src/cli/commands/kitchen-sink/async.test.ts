import KitchenSinkAsync from './async.js'
import {asyncTasks as asyncTasksService} from '../../services/kitchen-sink/async.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../../services/kitchen-sink/async.js')

describe('kitchen-sink all command', () => {
  test('launches service', async () => {
    vi.mocked(asyncTasksService).mockResolvedValue()

    await KitchenSinkAsync.run([], import.meta.url)

    expect(asyncTasksService).toHaveBeenCalled()
  })
})
