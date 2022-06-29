import Version from './version'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {dependency, outputMocker} from '@shopify/cli-kit'
import {DependencyManager} from '@shopify/cli-kit/src/dependency'

const currentVersion = '2.2.2'
beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      dependency: {
        dependencyManagerUsedForCreating: vi.fn(),
        checkForNewVersion: vi.fn(),
        getOutputUpdateCLIReminder: vi.fn(),
      },
    }
  })
  vi.spyOn(Version.prototype as any, 'getCurrentVersion').mockReturnValue(currentVersion)
})

describe('check CLI version', () => {
  it.each(['yarn', 'npm', 'pnpm'])(
    'display latest version and %s upgrade message when a newer exists',
    async (dependencyManager: string) => {
      // Given

      const latestVersion = '3.0.10'
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.mocked(dependency.checkForNewVersion).mockResolvedValue(latestVersion)
      vi.mocked(dependency.dependencyManagerUsedForCreating).mockReturnValue(dependencyManager as DependencyManager)
      const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

      // When
      await Version.run()

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        CLI reminder"
      `)
      expect(outputReminder).toBeCalledWith(dependencyManager as DependencyManager, latestVersion)
      outputMock.clear()
    },
  )

  it('display only current version when no newer version exists', async () => {
    // Given
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(currentVersion)

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
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(undefined)

    // When
    await Version.run()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot('"Current Shopify CLI version: 2.2.2"')
    outputMock.clear()
  })
})
