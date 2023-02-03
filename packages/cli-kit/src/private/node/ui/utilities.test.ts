import {messageWithPunctuation} from './utilities.js'
import {tokenItemToString} from './components/TokenizedText.js'
import {describe, expect, test} from 'vitest'

describe('messageWithPunctuation', async () => {
  test("doesn't append a colon if the token ends with a question mark", async () => {
    expect(tokenItemToString(messageWithPunctuation('test?'))).toBe('test?')
  })

  test("doesn't append a colon if the array of tokens ends with a question mark", async () => {
    expect(tokenItemToString(messageWithPunctuation([{userInput: 'test'}, {filePath: 'asd?'}]))).toBe('test asd?')
  })

  test('appends a colon to the end of a single token', async () => {
    expect(tokenItemToString(messageWithPunctuation('test'))).toBe('test:')
  })

  test('appends a colon to the end of an array of tokens', async () => {
    expect(tokenItemToString(messageWithPunctuation([{userInput: 'test'}, {filePath: 'asd'}]))).toBe('test asd:')
  })

  test("doesn't append a colon if there already is a colon", async () => {
    expect(tokenItemToString(messageWithPunctuation('test:'))).toBe('test:')
  })
})
