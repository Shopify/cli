import {autoUpgradeIfNeeded} from './postrun.js'
import {versionToAutoUpgrade, runCLIUpgrade, getOutputUpdateCLIReminder} from '../upgrade.js'
import {isMajorVersionChange} from '../version.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {describe, test, vi, expect, afterEach} from 'vitest'

vi.mock('../upgrade.js')
vi.mock('../version.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
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
    vi.mocked(runCLIUpgrade).mockResolvedValue(undefined)

    await autoUpgradeIfNeeded()

    expect(runCLIUpgrade).toHaveBeenCalledOnce()
  })

  test('on runCLIUpgrade failure shows warning', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionToAutoUpgrade).mockReturnValue('3.100.0')
    vi.mocked(isMajorVersionChange).mockReturnValue(false)
    vi.mocked(runCLIUpgrade).mockRejectedValue(new Error('upgrade failed'))
    vi.mocked(getOutputUpdateCLIReminder).mockReturnValue('💡 Version 3.100.0 available! Run `npm install -g @shopify/cli@latest`')

    await autoUpgradeIfNeeded()

    expect(outputMock.warn()).toContain('3.100.0')
  })
})
