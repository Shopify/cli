import {AbortError, BugError, handler, cleanSingleStackTracePath, shouldReportErrorAsUnexpected} from './error.js'
import {renderFatalError} from './ui.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./ui.js')

describe('handler', () => {
  test('error output uses same input error instance when the error type is abort', async () => {
    // Given
    const abortError = new AbortError('error message', 'try message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(abortError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(abortError)
  })

  test('error output uses same input error instance when the error type is bug', async () => {
    // Given
    const bugError = new BugError('error message', 'try message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(bugError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(bugError)
  })

  test('error output uses a BugError instance instance when the error type not extends from fatal', async () => {
    // Given
    const unknownError = new Error('Unknown')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(unknownError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(expect.objectContaining({type: expect.any(Number)}))
    expect(unknownError).not.contains({type: expect.any(Number)})
  })
})

describe('stack file path helpers', () => {
  test.each([
    ['simple file:///', 'file:///something/there.js'],
    ['windows file://', 'file:///D:\\something\\there.js'],
    ['unix no file', '/something/there.js'],
    ['windows no file', 'D:\\something\\there.js'],
  ])('%s', (_, path) => {
    expect(cleanSingleStackTracePath(path)).toEqual('/something/there.js')
  })
})

describe('shouldReportErrorAsUnexpected helper', () => {
  test('returns true for normal errors', () => {
    expect(shouldReportErrorAsUnexpected(new Error('test'))).toBe(true)
  })

  test('returns false for AbortError', () => {
    expect(shouldReportErrorAsUnexpected(new AbortError('test'))).toBe(false)
  })

  test('returns true for BugError', () => {
    expect(shouldReportErrorAsUnexpected(new BugError('test'))).toBe(true)
  })

  test('returns false for errors that imply environment issues', () => {
    expect(shouldReportErrorAsUnexpected(new Error('EPERM: operation not permitted, scandir'))).toBe(false)
  })
})
