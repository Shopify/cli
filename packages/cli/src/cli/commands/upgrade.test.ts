import Upgrade from './upgrade.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade', () => ({
  runCLIUpgrade: vi.fn().mockResolvedValue(undefined),
}))

describe('upgrade command', () => {
  test('calls runCLIUpgrade', async () => {
    const {runCLIUpgrade} = await import('@shopify/cli-kit/node/upgrade')

    await Upgrade.run([], import.meta.url)

    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })
})
