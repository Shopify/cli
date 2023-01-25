import Version from './version.js'
import {versionService} from '../services/commands/version.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'

describe('version command', () => {
  beforeEach(() => {
    vi.mock('../services/commands/version.js')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches the service', async () => {
    vi.mocked(versionService).mockResolvedValue()

    await Version.run([], import.meta.url)

    expect(versionService).toHaveBeenCalled()
  })
})
