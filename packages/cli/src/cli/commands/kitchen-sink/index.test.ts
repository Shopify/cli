import KitchenSinkAll from './index.js'
import {asyncTasks as asyncTasksService} from '../../services/kitchen-sink/async.js'
import {staticService} from '../../services/kitchen-sink/static.js'
import {prompts as promptsService} from '../../services/kitchen-sink/prompts.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../../services/kitchen-sink/prompts.js')
    vi.mock('../../services/kitchen-sink/static.js')
    vi.mock('../../services/kitchen-sink/async.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(asyncTasksService).mockResolvedValue()
    vi.mocked(staticService).mockResolvedValue()
    vi.mocked(promptsService).mockResolvedValue()

    await KitchenSinkAll.run([], import.meta.url)

    expect(asyncTasksService).toHaveBeenCalled()
    expect(staticService).toHaveBeenCalled()
    expect(promptsService).toHaveBeenCalled()
  })
})
