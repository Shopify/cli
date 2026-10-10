import AutoupgradeOff from './off.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeOff', () => {
  test('disables auto-upgrade', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await AutoupgradeOff.run([], import.meta.url)

    // Then
    expect(setAutoUpgradeEnabled).toBeCalledWith(false)
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Auto-upgrade off. You'll need to run \`shopify upgrade\` to update manually.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })
})
