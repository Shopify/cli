import {platformAndArch} from './os.js'
import {describe, it, expect, vi} from 'vitest'
import {arch as osArch} from 'node:os'

vi.mock('node:os')
vi.mock('node:process')

describe('platformAndArch', () => {
  it("returns the right architecture when it's x64", () => {
    // Given
    vi.mocked(osArch).mockReturnValue('x64')

    // When
    const got = platformAndArch('darwin')

    // Got
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('amd64')
  })

  it('returns the right architecture', () => {
    // Given
    vi.mocked(osArch).mockReturnValue('arm64')

    // When
    const got = platformAndArch('darwin')

    // Got
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('arm64')
  })

  it('returns the right platform', () => {
    // Given
    vi.mocked(osArch).mockReturnValue('arm64')

    // When
    const got = platformAndArch('win32')

    // Got
    expect(got.platform).toEqual('windows')
    expect(got.arch).toEqual('arm64')
  })
})
