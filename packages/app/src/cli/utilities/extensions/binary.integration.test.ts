import {getBinaryPathOrDownload} from './binary.js'
import {expect, it, vi} from 'vitest'
import {file, constants} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    constants: {
      paths: {
        directories: {
          cache: {
            vendor: {
              binaries: vi.fn(),
            },
          },
        },
      },
    },
  }
})

it(
  'downloads, validates, and untars the binary',
  async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(tmpDir)

      // Then
      const binaryPath = await getBinaryPathOrDownload()

      // Then
      await expect(file.exists(binaryPath)).resolves.toEqual(true)
    })
  },
  30 * 1000,
)
