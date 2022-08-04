import {inTemporaryDirectory, write} from './file.js'
import {join} from './path.js'
import * as haiku from './haiku.js'
import {randomPick} from './array.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./array.js')

describe('generate', () => {
  test('rerolls the name if a directory exists with the same name', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(randomPick).mockReturnValueOnce('taken')
      vi.mocked(randomPick).mockReturnValueOnce('directory')
      vi.mocked(randomPick).mockReturnValueOnce('free')
      vi.mocked(randomPick).mockReturnValueOnce('directory')

      const content = 'test'
      const filePath = join(tmpDir, 'taken-directory-app')
      await write(filePath, content)

      // When
      const got = await haiku.generate({suffix: 'app', directory: tmpDir})

      // Then
      expect(got).toEqual('free-directory-app')
      expect(randomPick).toHaveBeenCalledTimes(4)
    })
  })

  test('produces a name only containing the safe words', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.restoreAllMocks()

      // When
      const got = await haiku.generate({suffix: 'app', directory: tmpDir})

      // Then
      expect(got).toMatch(new RegExp(`${haiku.SAFE_ADJECTIVES.join('|')}-${haiku.SAFE_NOUNS.join('|')}-app`))
    })
  })
})
