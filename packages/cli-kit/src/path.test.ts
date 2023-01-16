import {glob, relativize} from './path.js'
import FastGlob from 'fast-glob'
import {describe, test, expect, it, vi} from 'vitest'

describe('path-glob', () => {
  it('calls fastGlob with dot:true if no dot option is passed', async () => {
    // Given
    vi.mock('fast-glob')

    // When
    await glob('pattern')

    // Then
    expect(FastGlob).toBeCalledWith('pattern', {dot: true})
  })

  it('calls fastGlob with dot option if passed', async () => {
    // Given
    vi.mock('fast-glob')

    // When
    await glob('pattern', {dot: false})

    // Then
    expect(FastGlob).toBeCalledWith('pattern', {dot: false})
  })
})

describe('relativize', () => {
  test('relativizes the path', () => {
    // Given
    const cwd = '/path/to/project/sub-directory'
    const directory = '/path/to/project/extensions/my-extension'

    // When
    const got = relativize(directory, cwd)

    // Then
    expect(got).toMatchInlineSnapshot('"../extensions/my-extension"')
  })
})
