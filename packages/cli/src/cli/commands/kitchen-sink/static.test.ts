import KitchenSinkBanners from './static.js'
import {staticService} from '../../services/kitchen-sink/static.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../../services/kitchen-sink/static.js')

describe('kitchen-sink all command', () => {
  test('launches service', async () => {
    vi.mocked(staticService).mockResolvedValue()

    await KitchenSinkBanners.run([], import.meta.url)

    expect(staticService).toHaveBeenCalled()
  })
})
