import {autoUpgradeIfNeeded} from './postrun.js'
import {versionToAutoUpgrade, runCLIUpgrade, getOutputUpdateCLIReminder} from '../upgrade.js'
import {isMajorVersionChange} from '../version.js'
import {inferPackageManagerForGlobalCLI} from '../is-global.js'
import {addPublicMetadata} from '../metadata.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {describe, test, vi, expect, afterEach} from 'vitest'

vi.mock('../upgrade.js')
vi.mock('../version.js')
vi.mock('../is-global.js')
vi.mock('../metadata.js', () => ({
  addPublicMetadata: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.mocked(addPublicMetadata).mockClear()
})

describe('autoUpgradeIfNeeded', () => {
  test('skips when versionToAutoUpgrade returns undefined', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue(undefined)

    await autoUpgradeIfNeeded()

    expect(runCLIUpgrade).not.toHaveBeenCalled()
  })

  test('shows warning for major version change and does not run upgrade', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionToAutoUpgrade).mockReturnValue('4.0.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(true)
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue('💡 Version 4.0.0 available! Run `brew upgrade shopify-cli`')

    await autoUpgradeIfNeeded()

    expect(runCLIUpgrade).not.toHaveBeenCalled()
    expect(outputMock.warn()).toContain('4.0.0')
  })

  test('calls runCLIUpgrade for minor/patch upgrade', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await autoUpgradeIfNeeded()

    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })

  test('on runCLIUpgrade failure shows warning', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockRejectedValue(new Error('upgrade failed'))
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue(
      '💡 Version 3.100.0 available! Run `npm install -g @shopify/cli@latest`',
    )

    await autoUpgradeIfNeeded()

    expect(outputMock.warn()).toContain('3.100.0')
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
        cmd_all_auto_upgrade_triggered: true,
        cmd_all_auto_upgrade_package_manager: 'npm',
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
        cmd_all_auto_upgrade_triggered: true,
        cmd_all_auto_upgrade_skipped_reason: 'major_version',
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
    expect(calls).toContainEqual(expect.objectContaining({cmd_all_auto_upgrade_success: true}))
  })

  test('records success=false on failed upgrade', async () => {
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(runCLIUpgrade).mockRejectedValue(new Error('upgrade failed'))
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue('upgrade reminder')

    await autoUpgradeIfNeeded()

    const calls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(calls).toContainEqual(expect.objectContaining({cmd_all_auto_upgrade_success: false}))
  })
})
