import Upgrade from './upgrade'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {constants, file, outputMocker} from '@shopify/cli-kit'
// import {
  // checkForNewVersion,
// } from '@shopify/cli-kit/node/node-package-manager'

// const oldCliVersion = '3.0.0'

beforeEach(async () => {
  vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(await constants.versions.cliKit())
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      output: {
        ...module.output,
        getOutputUpdateCLIReminder: vi.fn(),
      },
      system: {
        ...module.system,
        captureOutput: vi.fn(),
        exec: vi.fn(),
      }
    }
  })
})
afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
})

describe('upgrade global CLI', () => {
  it('does not upgrade globally if the latest version is found', async () => {
    const currentCliVersion = await constants.versions.cliKit()
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputMock = outputMocker.mockAndCaptureOutput()
      vi.spyOn(Upgrade.prototype as any, 'parse').mockResolvedValue({flags: {path: tmpDir}})
      vi.spyOn(Upgrade.prototype as any, 'getCurrentVersion').mockReturnValue(currentCliVersion)
      vi.spyOn(Upgrade.prototype as any, 'usingPackageManager').mockReturnValue(false)

      // When
      await Upgrade.run()

      // Then
      expect(outputMock.info()).toMatchInlineSnapshot(`
        "You're on the latest version, ${currentCliVersion}, no need to upgrade!"
      `)
    })
  })
})
