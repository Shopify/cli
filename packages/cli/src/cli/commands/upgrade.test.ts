import Upgrade from './upgrade.js'
import {promptAutoUpgrade, runCLIUpgrade} from '@shopify/cli-kit/node/upgrade'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('upgrade command', () => {
  test('calls promptAutoUpgrade and runCLIUpgrade', async () => {
    vi.mocked(promptAutoUpgrade).mockResolvedValue(true)
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await Upgrade.run([], import.meta.url)

    expect(promptAutoUpgrade).toHaveBeenCalledOnce()
    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })
})
