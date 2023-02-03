import KitchenSinkAll from './index.js'
import {asyncTasks as asyncTasksService} from '../../services/kitchen-sink/async.js'
import {banners as bannersTasksService} from '../../services/kitchen-sink/banners.js'
import {prompts as promptsTasksService} from '../../services/kitchen-sink/prompts.js'
import {describe, test, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../../services/kitchen-sink/prompts.js')
    vi.mock('../../services/kitchen-sink/banners.js')
    vi.mock('../../services/kitchen-sink/async.js')
  })

  test('launches service', async () => {
    vi.mocked(asyncTasksService).mockResolvedValue()
    vi.mocked(bannersTasksService).mockResolvedValue()
    vi.mocked(promptsTasksService).mockResolvedValue()

    await KitchenSinkAll.run([], import.meta.url)

    expect(asyncTasksService).toHaveBeenCalled()
    expect(bannersTasksService).toHaveBeenCalled()
    expect(promptsTasksService).toHaveBeenCalled()
  })
})
