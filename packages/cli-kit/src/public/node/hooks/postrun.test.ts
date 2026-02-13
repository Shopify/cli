import {autoUpgradeIfNeeded} from './postrun.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {getOutputUpdateCLIReminder, runCLIUpgrade, versionToAutoUpgrade} from '../upgrade.js'
import {describe, expect, test, vi, afterEach} from 'vitest'

vi.mock('../upgrade.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    runCLIUpgrade: vi.fn(),
    getOutputUpdateCLIReminder: vi.fn(),
    versionToAutoUpgrade: vi.fn(),
  }
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('autoUpgradeIfNeeded', () => {
  test('runs the upgrade when versionToAutoUpgrade returns a version', async () => {
    // Given
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.91.0')
    vi.mocked(runCLIUpgrade).mockResolvedValue()

    // When
    await autoUpgradeIfNeeded()

    // Then
    expect(runCLIUpgrade).toHaveBeenCalled()
  })

  test('falls back to warning when the upgrade fails', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.91.0')
    vi.mocked(runCLIUpgrade).mockRejectedValue(new Error('upgrade failed'))
    const installReminder = '💡 Version 3.91.0 available! Run `npm install @shopify/cli@latest`'
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue(installReminder)

    // When
    await autoUpgradeIfNeeded()

    // Then
    expect(outputMock.warn()).toMatch(installReminder)
  })

  test('does nothing when versionToAutoUpgrade returns undefined', async () => {
    // Given
    vi.mocked(versionToAutoUpgrade).mockReturnValue(undefined)

    // When
    await autoUpgradeIfNeeded()

    // Then
    expect(runCLIUpgrade).not.toHaveBeenCalled()
  })
})
