import {versionService} from './version.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  checkForNewVersion,
  PackageManager,
  packageManagerUsedForCreating,
} from '@shopify/cli-kit/node/node-package-manager'
import {CancelExecution} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '2.2.2'}))
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('check CLI version', () => {
  it.each(['yarn', 'npm', 'pnpm'])(
    'displays latest version and %s upgrade message when a newer exists',
    async (packageManager: string) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      vi.mocked(checkForNewVersion).mockResolvedValue('3.0.10')
      vi.mocked(packageManagerUsedForCreating).mockReturnValue(packageManager as PackageManager)

      // When
      await expect(async () => {
        await versionService()
      }).rejects.toThrowError(new CancelExecution())

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        💡 Version 3.0.10 available! Run ${packageManager === 'npm' ? 'npm run' : packageManager} shopify upgrade"
      `)
    },
  )

  it('displays only current version when no newer version exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    // When
    await expect(async () => {
      await versionService()
    }).rejects.toThrowError(new CancelExecution())

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`"Current Shopify CLI version: 2.2.2"`)
  })
})
