import Upgrade from './upgrade.js'
import {runCLIUpgrade} from '@shopify/cli-kit/node/upgrade'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('upgrade command', () => {
  test('calls runCLIUpgrade directly without prompting', async () => {
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await Upgrade.run([], import.meta.url)

    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })
})
