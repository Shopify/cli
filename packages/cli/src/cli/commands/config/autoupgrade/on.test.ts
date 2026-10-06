import AutoupgradeOn from './on.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeOn', () => {
  test('enables auto-upgrade', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await AutoupgradeOn.run([], import.meta.url)

    // Then
    expect(setAutoUpgradeEnabled).toBeCalledWith(true)
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Auto-upgrade on. Shopify CLI will update automatically after each command.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })
})
