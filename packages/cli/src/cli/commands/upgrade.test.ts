import Upgrade from './upgrade.js'
import {upgradeCLI} from '@shopify/cli-kit/node/upgrade'
import {upgradeJsonOutputSchema} from '@shopify/cli-kit/node/upgrade/types'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

afterEach(() => mockAndCaptureOutput().clear())

describe('upgrade command', () => {
  test('exposes the result schema and JSON flags in help', () => {
    expect(Upgrade.jsonOutputSchema).toBe(upgradeJsonOutputSchema)
    expect(Upgrade.flags.json).toBeDefined()
    expect(Upgrade.description).toContain('Output from `--json` conforms to the `UpgradeResult` schema.')
  })

  test('encodes the result when JSON is requested', async () => {
    const result = {
      status: 'upgraded',
      scope: 'global',
      previousVersion: '4.8.0',
      version: '4.9.0',
      packageManager: 'npm',
    } as const
    vi.mocked(upgradeCLI).mockResolvedValue(result)

    await Upgrade.run(['--json'], import.meta.url)

    expect(mockAndCaptureOutput().output()).toBe(upgradeJsonOutputSchema.encode(result))
  })

  test('calls upgradeCLI directly without prompting', async () => {
    vi.mocked(upgradeCLI).mockResolvedValue({status: 'skipped', reason: 'development', scope: 'global'})

    await Upgrade.run([], import.meta.url)

    expect(upgradeCLI).toHaveBeenCalledOnce()
  })
})
