import KitchenSink from './kitchen-sink.js'
import {kitchenSink as kitchenSinkService} from '../services/kitchen-sink.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('upgrade command', () => {
  beforeEach(() => {
    vi.mock('../services/kitchen-sink.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(kitchenSinkService).mockResolvedValue()

    await KitchenSink.run([], import.meta.url)

    expect(kitchenSinkService).toHaveBeenCalledWith()
  })
})
