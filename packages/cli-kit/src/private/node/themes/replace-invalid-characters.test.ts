import {replaceInvalidCharacters} from './replace-invalid-characters.js'
import {describe, expect, test} from 'vitest'

describe('replaceInvalidCharacters', () => {
  test('should replace unused ASCII characters', () => {
    const asciiStringChar = '\x8F'
    expect(replaceInvalidCharacters(`theme-dev-${asciiStringChar}.lan`)).toEqual('theme-dev---lan')
  })

  test('should not replace non-latin letters and marks', () => {
    const hostName = 'ÇaVaこんにちはПривіт'
    expect(replaceInvalidCharacters(hostName)).toEqual(hostName)
  })
})
