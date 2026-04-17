import AutoupgradeStatus from './status.js'
import {getAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {Config} from '@oclif/core'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeStatus', () => {
  test('displays auto-upgrade on message when enabled', async () => {
    // Given
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await new AutoupgradeStatus([], config).run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Auto-upgrade on. Shopify CLI will update automatically after each command.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })

  test('displays auto-upgrade off message when disabled', async () => {
    // Given
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(false)
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await new AutoupgradeStatus([], config).run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Auto-upgrade off. You'll need to run \`shopify upgrade\` to update manually.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })

  test('displays not configured message when never set', async () => {
    // Given
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(undefined)
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await new AutoupgradeStatus([], config).run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Auto-upgrade not configured. Run \`shopify config autoupgrade on\` to enable  │
    │   it.                                                                        │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })
})
