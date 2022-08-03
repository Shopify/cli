import Version from './version'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {outputMocker, output} from '@shopify/cli-kit'
import {
  checkForNewVersion,
  PackageManager,
  packageManagerUsedForCreating,
} from '@shopify/cli-kit/node/node-package-manager'

const currentVersion = '2.2.2'
beforeEach(() => {
  vi.spyOn(Version.prototype as any, 'getCurrentVersion').mockReturnValue(currentVersion)
  vi.mock('@shopify/cli-kit/node/node-package-manager')
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
  outputMocker.mockAndCaptureOutput().clear()
})

describe('check CLI version', () => {
  it.each(['yarn', 'npm', 'pnpm'])(
    'display latest version and %s upgrade message when a newer exists',
    async (packageManager: string) => {
      // Given

      const latestVersion = '3.0.10'
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)
      vi.mocked(packageManagerUsedForCreating).mockReturnValue(packageManager as PackageManager)
      const outputReminder = vi.mocked(output.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

      // When
      await Version.run()

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
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue(currentVersion)

    // When
    await Version.run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Current Shopify CLI version: 2.2.2
      "
    `)
    outputMock.clear()
  })

  it('display only current version when an error is thrown when getting latest version', async () => {
    // Given
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    // When
    await Version.run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"Current Shopify CLI version: 2.2.2"')
    outputMock.clear()
  })
})
