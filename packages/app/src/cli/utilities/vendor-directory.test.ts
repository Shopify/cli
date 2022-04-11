import {directory as getVendorDirectoryPath} from './vendor-directory'
import {describe, it, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    file: {
      exists: vi.fn(),
      mkdir: vi.fn(),
    },
  }
})

describe('path', () => {
  it('locates the directory', async () => {
    // When
    const got = await getVendorDirectoryPath()

    // Then
    expect(got).not.toEqual('')
  })
})
