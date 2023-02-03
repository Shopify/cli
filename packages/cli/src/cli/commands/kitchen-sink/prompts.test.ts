import KitchenSinkPrompts from './prompts.js'
import {prompts as promptsService} from '../../services/kitchen-sink/prompts.js'
import {describe, test, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../../services/kitchen-sink/prompts.js')
  })

  test('launches service', async () => {
    vi.mocked(promptsService).mockResolvedValue()

    await KitchenSinkPrompts.run([], import.meta.url)

    expect(promptsService).toHaveBeenCalled()
  })
})
