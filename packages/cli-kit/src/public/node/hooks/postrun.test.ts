import {autoUpgradeIfNeeded} from './postrun.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {getOutputUpdateCLIReminder, runCLIUpgrade, versionToAutoUpgrade} from '../upgrade.js'
import {isMajorVersionChange} from '../version.js'
import {inferPackageManagerForGlobalCLI} from '../is-global.js'
import {addPublicMetadata} from '../metadata.js'
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

vi.mock('../version.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    isMajorVersionChange: vi.fn(),
  }
})

vi.mock('../is-global.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    inferPackageManagerForGlobalCLI: vi.fn(),
  }
})

vi.mock('../metadata.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    addPublicMetadata: vi.fn().mockResolvedValue(undefined),
  }
})

// Always execute the task so the rate limit doesn't interfere with tests
vi.mock('../../../private/node/conf-store.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    runAtMinimumInterval: vi.fn(async (_key: string, _interval: object, task: () => Promise<void>) => {
      await task()
      return true
    }),
  }
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.mocked(addPublicMetadata).mockClear()
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

  test('shows warning instead of upgrading for a major version change', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionToAutoUpgrade).mockReturnValue('4.0.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(true)
    const installReminder = '💡 Version 4.0.0 available! Run `npm install @shopify/cli@latest`'
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue(installReminder)

    // When
    await autoUpgradeIfNeeded()

    // Then
    expect(runCLIUpgrade).not.toHaveBeenCalled()
    expect(getOutputUpdateCLIReminder).toHaveBeenCalledWith('4.0.0', true)
    expect(outputMock.warn()).toMatch(installReminder)
  })

  test('records triggered metric for minor/patch upgrade', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await autoUpgradeIfNeeded()

    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(
      expect.objectContaining({
        env_auto_upgrade_triggered: true,
        env_auto_upgrade_package_manager: 'npm',
      }),
    )
  })

  test('records triggered metric with major_version skipped_reason for major bump', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('4.0.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(true)
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue('upgrade reminder')

    await autoUpgradeIfNeeded()

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(
      expect.objectContaining({
        env_auto_upgrade_triggered: true,
        env_auto_upgrade_skipped_reason: 'major_version',
      }),
    )
  })

  test('records success=true on successful upgrade', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await autoUpgradeIfNeeded()

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(expect.objectContaining({env_auto_upgrade_success: true}))
  })

  test('records success=false on failed upgrade', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockRejectedValue(new Error('upgrade failed'))
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue('upgrade reminder')

    await autoUpgradeIfNeeded()

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(expect.objectContaining({env_auto_upgrade_success: false}))
  })
})
