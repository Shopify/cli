import {join as pathJoin} from './path'
import {write as fileWrite} from './file'
import {validateMD5, InvalidChecksumError} from './checksum'
import {fetch} from './http'
import {temporary} from '@shopify/cli-testing'
import {describe, it, expect, vi} from 'vitest'

vi.mock('./http')

describe('validate', () => {
  it("resolves if the MD5 matches the file's", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const hash = '098f6bcd4621d373cade4e832627b4f6'
      const file = pathJoin(tmpDir, 'file.txt')
      await fileWrite(file, content)
      const response: any = {
        text: () => {
          return Promise.resolve(hash)
        },
      }
      vi.mocked(fetch).mockResolvedValue(response)

      // When
      await validateMD5({file, md5FileURL: 'https://test.shopify.com/md5-file'})
    })
  })

  it('rejects when the hash is invalid', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const content = 'test'
      const remoteHash = 'other'
      const hash = '098f6bcd4621d373cade4e832627b4f6'
      const file = pathJoin(tmpDir, 'file.txt')
      await fileWrite(file, content)
      const response: any = {
        text: () => {
          return Promise.resolve(remoteHash)
        },
      }
      vi.mocked(fetch).mockResolvedValue(response)

      // When
      await expect(validateMD5({file, md5FileURL: 'https://test.shopify.com/md5-file'})).rejects.toThrowError(
        InvalidChecksumError({file, expected: remoteHash, got: hash}),
      )
    })
  })
})
