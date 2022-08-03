import {Abort, Bug, handler, cleanSingleStackTracePath} from './error.js'
import {error} from './output.js'
import {describe, expect, test, vi, beforeEach, it} from 'vitest'

beforeEach(() => {
  vi.mock('./output')
})

describe('handler', () => {
  test('error output uses same input error instance when the error type is abort', async () => {
    // Given
    const abortError = new Abort('error message', 'try message')
    vi.mocked(error).mockResolvedValue()

    // When
    await handler(abortError)

    // Then
    expect(error).toHaveBeenCalledWith(abortError)
  })

  test('error output uses same input error instance when the error type is bug', async () => {
    // Given
    const bugError = new Bug('error message', 'try message')
    vi.mocked(error).mockResolvedValue()

    // When
    await handler(bugError)

    // Then
    expect(error).toHaveBeenCalledWith(bugError)
  })

  test('error output uses a Bug instance instance when the error type not extends from fatal', async () => {
    // Given
    const unknownError = new Error('Unknown')
    vi.mocked(error).mockResolvedValue()

    // When
    await handler(unknownError)

    // Then
    expect(error).toHaveBeenCalledWith(expect.objectContaining({type: expect.any(Number)}))
    expect(unknownError).not.contains({type: expect.any(Number)})
  })
})

describe('stack file path helpers', () => {
  it.each([
    ['simple file:///', 'file:///something/there.js'],
    ['windows file://', 'file:///D:\\something\\there.js'],
    ['unix no file', '/something/there.js'],
    ['windows no file', 'D:\\something\\there.js'],
  ])('%s', (_, path) => {
    expect(cleanSingleStackTracePath(path)).toEqual('/something/there.js')
  })
})
