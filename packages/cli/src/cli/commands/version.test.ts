import Version from './version'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {outputMocker} from '@shopify/cli-testing'
import {dependency} from '@shopify/cli-kit'
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
  function getDependencyManagerUpgradeCommand(dependencyManager: string): string {
    return `${dependencyManager} ${dependencyManager === 'yarn' ? 'upgrade' : 'update'}`
  }

  it.each(['yarn', 'npm', 'pnpm'])(
    'display lastest version and %s upgrade message when a newer exists',
    async (dependencyManager: string) => {
      // Given

      const lastestVersion = '3.0.10'
      const outputMock = outputMocker.mockAndCapture()
      vi.mocked(dependency.checkForNewVersion).mockResolvedValue(lastestVersion)
      vi.mocked(dependency.dependencyManagerUsedForCreating).mockReturnValue(dependencyManager as DependencyManager)
      const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

      // When
      await Version.run()

      // Then
      const result = `Current Shopify CLI version: \u001b[33m${currentVersion}\u001b[39m\nLastest Shopify CLI version: \u001b[33m${lastestVersion}\u001b[39m\n💡\nCLI reminder`
      expect(outputMock.info()).toMatch(result)
      expect(outputReminder).toBeCalledWith(dependencyManager as DependencyManager)
    },
  )

  it('display only current version when no newer version exists', async () => {
    // Given
    const outputMock = outputMocker.mockAndCapture()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(currentVersion)

    // When
    await Version.run()

    // Then
    expect(outputMock.info()).toMatch(`Current Shopify CLI version: \u001b[33m${currentVersion}\u001b[39m`)
  })

  it('display only current version when an error is thrown when getting latest version', async () => {
    // Given
    const outputMock = outputMocker.mockAndCapture()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(undefined)

    // When
    await Version.run()

    // Then
    expect(outputMock.info()).toMatch(`Current Shopify CLI version: \u001b[33m${currentVersion}\u001b[39m`)
  })
})
