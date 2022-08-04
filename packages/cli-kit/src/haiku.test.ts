import {inTemporaryDirectory, write} from './file.js'
import {join} from './path.js'
import {generate} from './haiku.js'
import {describe, expect, test, vi} from 'vitest'

describe('generate', () => {
  test('rerolls the name if a directory exists with the same name', async () => {
    // make randonmess predictable and pick from the array of adjectives and nouns
    // in succession
    const randomPick = vi.fn((array: string[]) => array[Math.floor(Math.random() * array.length)])

    // first items of the adjective and noun arrays
    randomPick.mockImplementationOnce((array: string[]) => array[0])
    randomPick.mockImplementationOnce((array: string[]) => array[0])
    randomPick.mockImplementationOnce((array: string[]) => array[1])
    randomPick.mockImplementationOnce((array: string[]) => array[1])

    await inTemporaryDirectory(async (tmpDir) => {
      const content = 'test'
      const filePath = join(tmpDir, 'commercial-account-app')
      await write(filePath, content)

      await expect(generate({suffix: 'app', directory: tmpDir, randomPick})).resolves.toEqual('profitable-consumer-app')
      expect(randomPick).toHaveBeenCalledTimes(4)
    })
  })
})
