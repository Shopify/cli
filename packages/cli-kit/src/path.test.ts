import {glob} from './path.js'
import FastGlob from 'fast-glob'
import {describe, expect, it, vi} from 'vitest'

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
