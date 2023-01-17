import KitchenSinkAsync from './async.js'
import {asyncTasks as asyncTasksService} from '../../services/kitchen-sink/async.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../../services/kitchen-sink/async.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(asyncTasksService).mockResolvedValue()

    await KitchenSinkAsync.run([], import.meta.url)

    expect(asyncTasksService).toHaveBeenCalled()
  })
})
