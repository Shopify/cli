import KitchenSinkPrompts from './prompts.js'
import {prompts as promptsService} from '../../services/kitchen-sink/prompts.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../../services/kitchen-sink/prompts.js')

describe('kitchen-sink all command', () => {
  test('launches service', async () => {
    vi.mocked(promptsService).mockResolvedValue()

    await KitchenSinkPrompts.run([], import.meta.url)

    expect(promptsService).toHaveBeenCalled()
  })
})
