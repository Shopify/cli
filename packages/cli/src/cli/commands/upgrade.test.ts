import Upgrade from './upgrade.js'
import {promptAutoUpgrade, runCLIUpgrade} from '@shopify/cli-kit/node/upgrade'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {describe, test, vi, expect, afterEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  vi.mocked(addPublicMetadata).mockClear()
})

describe('upgrade command', () => {
  test('calls promptAutoUpgrade and runCLIUpgrade', async () => {
    vi.mocked(promptAutoUpgrade).mockResolvedValue(true)
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await Upgrade.run([], import.meta.url)

    expect(promptAutoUpgrade).toHaveBeenCalledOnce()
    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })

  test('records env_auto_upgrade_accepted=true when user opts in', async () => {
    vi.mocked(promptAutoUpgrade).mockResolvedValue(true)
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await Upgrade.run([], import.meta.url)

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(expect.objectContaining({env_auto_upgrade_accepted: true}))
  })

  test('records env_auto_upgrade_accepted=false when user opts out', async () => {
    vi.mocked(promptAutoUpgrade).mockResolvedValue(false)
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await Upgrade.run([], import.meta.url)

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(expect.objectContaining({env_auto_upgrade_accepted: false}))
  })
})
