import {temporarelyChangeCWD} from './path.js'
import {beforeEach, describe, it, vi, expect} from 'vitest'

const mockedChdir = vi.fn(() => {})
const mockedcwd = vi.fn(() => '')

beforeEach(() => {
  process.cwd = mockedcwd
  process.chdir = mockedChdir
})

describe('temporarelyChangeCWD', () => {
  it('changes cwd, then returns to original cwd', async () => {
    const originalCwd = '/current/test/dir'
    const tmpCwd = '/new/test/dir'
    const callback = vi.fn(async () => 'result')

    mockedcwd.mockReturnValue(originalCwd)
    const result = await temporarelyChangeCWD(tmpCwd, callback)

    expect(result).toBe(result)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(mockedcwd).toHaveBeenCalledTimes(1)
    expect(mockedChdir).toHaveBeenNthCalledWith(1, tmpCwd)
    expect(mockedChdir).toHaveBeenNthCalledWith(2, originalCwd)
  })

  it('returns to original cwd on callback error', async () => {
    const callback = vi.fn(async () => {
      throw new Error()
    })

    await expect(temporarelyChangeCWD('/test/dir', callback)).rejects.toThrowError(new Error())
    await expect(mockedChdir).toHaveBeenCalledTimes(2)
  })
})
