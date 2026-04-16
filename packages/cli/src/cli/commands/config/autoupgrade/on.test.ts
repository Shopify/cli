import AutoupgradeOn from './on.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {Config} from '@oclif/core'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeOn', () => {
  test('enables auto-upgrade', async () => {
    // Given
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()

    // When
    await new AutoupgradeOn([], config).run()

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
