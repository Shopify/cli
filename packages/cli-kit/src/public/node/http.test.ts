import {fileExists, inTemporaryDirectory, readFile} from './fs.js'
import {downloadFile} from './http.js'
import {joinPath} from './path.js'
import {describe, expect, test, vi} from 'vitest'
import nodeFetch, {Response} from 'node-fetch'
import {Readable} from 'stream'

vi.mock('node-fetch', async () => {
  const actual: any = await vi.importActual('node-fetch')
  return {
    ...actual,
    default: vi.fn(),
  }
})

describe('downloadFile', () => {
  test('Downloads a file from a URL to a local path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const url = 'https://example.com'
      const filename = '/bin/example.txt'
      const to = joinPath(tmpDir, filename)
      const response = new Response(Readable.from('Hello world'))

      vi.mocked(nodeFetch).mockResolvedValue(response)

      // When
      const result = await downloadFile(url, to)
      const exists = await fileExists(result)
      const contents = await readFile(result)

      // Then
      expect(result).toBe(to)
      expect(exists).toBe(true)
      expect(contents).toBe('Hello world')
    })
  })
})
