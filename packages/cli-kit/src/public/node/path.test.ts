import {relativizePath, cwd, normalizePath} from './path.js'
import {describe, test, expect} from 'vitest'

describe('relativize', () => {
  test('relativizes the path', () => {
    // Given
    const cwd = '/path/to/project/sub-directory'
    const directory = '/path/to/project/extensions/my-extension'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toMatchInlineSnapshot('"../extensions/my-extension"')
  })
})

describe('cwd', () => {
  test('returns the initial cwd where the command has been called', () => {
    // Given
    const path = cwd()

    // Then
    if (process.env.INIT_CWD) {
      // This env variable is only set when invoking a npm script
      expect(path).toStrictEqual(normalizePath(process.env.INIT_CWD))
    }
  })
})
