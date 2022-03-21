import {path as getVendorDirectoryPath, ensureExists} from './vendor-directory'
import {describe, it, expect, vi, afterEach} from 'vitest'
import {file} from '@shopify/cli-kit'

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

afterEach(() => {
  vi.mocked(file.mkdir).mockClear()
  vi.mocked(file.exists).mockClear()
})

describe('path', () => {
  it('locates the directory', async () => {
    // When
    const got = await getVendorDirectoryPath()

    // Then
    expect(got).not.toEqual('')
  })
})

describe('ensureExists', () => {
  it('locates the directory', async () => {
    // When
    const vendorDirectory = await getVendorDirectoryPath()
    vi.mocked(file.exists).mockResolvedValue(false)
    // When
    const got = await ensureExists()

    // Then
    expect(vi.mocked(file.exists)).toHaveBeenCalledWith(vendorDirectory)
    expect(vi.mocked(file.exists)).toHaveBeenCalledWith(vendorDirectory)
    expect(got).not.toEqual('')
  })
})
