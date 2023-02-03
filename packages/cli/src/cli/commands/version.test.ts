import Version from './version.js'
import {versionService} from '../services/commands/version.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../services/commands/version.js')

describe('version command', () => {
  test('launches service', async () => {
    vi.mocked(versionService).mockResolvedValue()

    await Version.run([], import.meta.url)

    expect(versionService).toHaveBeenCalled()
  })
})
