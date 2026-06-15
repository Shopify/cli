import AutoupgradeOff from './off.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {Config} from '@oclif/core'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeOff', () => {
  test('disables auto-upgrade', async () => {
    // Given
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()

    // When
    await new AutoupgradeOff([], config).run()

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
