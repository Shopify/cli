import Upgrade from './upgrade.js'
import {upgrade as upgradeService} from '../services/upgrade.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('upgrade command', () => {
  beforeEach(() => {
    vi.mock('../services/upgrade.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service with path', async () => {
    vi.mocked(upgradeService).mockResolvedValue()

    await Upgrade.run(['--path', '/something/over/../there'], import.meta.url)

    expect(upgradeService).toHaveBeenCalledWith('/something/there', expect.stringMatching(/3\./))
  })

  test('launches service with cwd', async () => {
    vi.mocked(upgradeService).mockResolvedValue()

    await Upgrade.run([], import.meta.url)

    expect(upgradeService).toHaveBeenCalledWith(expect.stringMatching(/cli$/), expect.stringMatching(/3\./))
  })
})
