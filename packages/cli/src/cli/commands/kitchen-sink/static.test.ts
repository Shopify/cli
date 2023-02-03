import KitchenSinkBanners from './static.js'
import {staticService} from '../../services/kitchen-sink/static.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('kitchen-sink all command', () => {
  beforeEach(() => {
    vi.mock('../../services/kitchen-sink/static.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    vi.mocked(staticService).mockResolvedValue()

    await KitchenSinkBanners.run([], import.meta.url)

    expect(staticService).toHaveBeenCalled()
  })
})
