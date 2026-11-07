import AutoupgradeStatus from './status.js'
import {getAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/upgrade')

describe('AutoupgradeStatus', () => {
  test('displays auto-upgrade on message when enabled', async () => {
    // Given
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AutoupgradeStatus.run([], import.meta.url)

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
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AutoupgradeStatus.run([], import.meta.url)

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

  test('displays auto-upgrade on message when never explicitly set (default enabled)', async () => {
    // Given
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await AutoupgradeStatus.run([], import.meta.url)

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
})
