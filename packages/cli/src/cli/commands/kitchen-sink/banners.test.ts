import KitchenSinkAll from './all.js'
import {banners as bannersService} from '../../services/kitchen-sink/banners.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../services/kitchen-sink/banners.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(bannersService).mockResolvedValue()

    await KitchenSinkAll.run([], import.meta.url)

    expect(bannersService).toHaveBeenCalled()
  })
})
