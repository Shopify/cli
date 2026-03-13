import Upgrade from './upgrade.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade', () => ({
  promptAutoUpgrade: vi.fn().mockResolvedValue(true),
  runCLIUpgrade: vi.fn().mockResolvedValue(undefined),
}))

describe('upgrade command', () => {
  test('calls promptAutoUpgrade and runCLIUpgrade', async () => {
    const {promptAutoUpgrade, runCLIUpgrade} = await import('@shopify/cli-kit/node/upgrade')

    await Upgrade.run([], import.meta.url)

    expect(promptAutoUpgrade).toHaveBeenCalledOnce()
    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })
})
