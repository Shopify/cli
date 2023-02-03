import KitchenSinkBanners from './banners.js'
import {banners as bannersService} from '../../services/kitchen-sink/banners.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../../services/kitchen-sink/banners.js')

describe('kitchen-sink all command', () => {
  test('launches service', async () => {
    vi.mocked(bannersService).mockResolvedValue()

    await KitchenSinkBanners.run([], import.meta.url)

    expect(bannersService).toHaveBeenCalled()
  })
})
