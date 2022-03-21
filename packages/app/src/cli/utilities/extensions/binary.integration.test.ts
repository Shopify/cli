import {getBinaryPathOrDownload} from './binary'
import {directory as getVendorDirectory} from '../vendor-directory'
import {expect, it, vi} from 'vitest'
import {temporary} from '@shopify/cli-testing'
import {file} from '@shopify/cli-kit'

vi.mock('../vendor-directory')

it('downloads, validates, and untars the binary', async () => {
  await temporary.directory(async (tmpDir) => {
    // Given
    vi.mocked(getVendorDirectory).mockResolvedValue(tmpDir)

    // Then
    const binaryPath = await getBinaryPathOrDownload()

    // Then
    await expect(file.exists(binaryPath)).resolves.toEqual(true)
  })
})
