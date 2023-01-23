import {versionService} from './version.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {output} from '@shopify/cli-kit'
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
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      output: {
        ...module.output,
        getOutputUpdateCLIReminder: vi.fn(),
      },
    }
  })
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('check CLI version', () => {
  it.each(['yarn', 'npm', 'pnpm'])(
    'display latest version and %s upgrade message when a newer exists',
    async (packageManager: string) => {
      // Given

      const latestVersion = '3.0.10'
      const outputMock = mockAndCaptureOutput()
      vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)
      vi.mocked(packageManagerUsedForCreating).mockReturnValue(packageManager as PackageManager)
      const outputReminder = vi.mocked(output.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

      // When
      await expect(async () => {
        await versionService()
      }).rejects.toThrowError(new CancelExecution())

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        CLI reminder"
      `)
      expect(outputReminder).toBeCalledWith(packageManager as PackageManager, latestVersion)
      outputMock.clear()
    },
  )

  it('display only current version when no newer version exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue('2.2.2')

    // When
    await expect(async () => {
      await versionService()
    }).rejects.toThrowError(new CancelExecution())

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Current Shopify CLI version: 2.2.2
      "
    `)
    outputMock.clear()
  })

  it('display only current version when an error is thrown when getting latest version', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    // When
    await expect(async () => {
      await versionService()
    }).rejects.toThrowError(new CancelExecution())

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"Current Shopify CLI version: 2.2.2"')
    outputMock.clear()
  })
})
