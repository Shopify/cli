import KitchenSinkAll from './all.js'
import {prompts as promptsService} from '../../services/kitchen-sink/prompts.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../services/kitchen-sink/prompts.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(promptsService).mockResolvedValue()

    await KitchenSinkAll.run([], import.meta.url)

    expect(promptsService).toHaveBeenCalled()
  })
})
