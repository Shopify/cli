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
    const bugError = new BugError('error message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(bugError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(bugError)
  })

  test('error output uses a BugError instance instance when the error type not extends from fatal', async () => {
    // Given
    const notFatalError = new Error('error message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(notFatalError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(BugError))
  })

  test('wraps string error into a BugError', async () => {
    // Given
    const stringValue = 'error message'
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(stringValue)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(BugError))
    expect(renderFatalError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: stringValue,
      }),
    )
  })

  test('handles unknown error with default message', async () => {
    // Given
    const errorObject = {custom: 'error object'}
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(errorObject)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(BugError))
    expect(renderFatalError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unknown error',
      }),
    )
  })
})

describe('stack file path helpers', () => {
  test('simple file:///', () => {
    const input = 'file:///Users/username/my/file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('windows file://', () => {
    // Normalize path strips the drive letter on the test machine
    const input = 'file://C:/Users/username/my/file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('unix no file', () => {
    const input = '/Users/username/my/file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('windows no file', () => {
    // Normalize path strips the drive letter on the test machine
    const input = 'C:\\Users\\username\\my\\file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('handles paths with multiple slashes', () => {
    const input = 'file:///Users/username//my///file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('handles Windows paths with backslashes and drive letter', () => {
    // Normalize path strips the drive letter on the test machine
    const input = 'C:\\Users\\username\\my\\file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('handles paths with URL encoded characters', () => {
    // The current implementation doesn't decode URL-encoded characters
    const input = 'file:///Users/user%20name/my/file.js'
    const expected = '/Users/user%20name/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('handles paths with mixed forward and backward slashes', () => {
    // Normalize path strips the drive letter on the test machine
    const input = 'C:\\Users/username\\my/file.js'
    const expected = '/Users/username/my/file.js'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })

  test('preserves query parameters', () => {
    const input = 'file:///Users/username/my/file.js?line=10'
    const expected = '/Users/username/my/file.js?line=10'
    expect(cleanSingleStackTracePath(input)).toBe(expected)
  })
})

describe('shouldReportErrorAsUnexpected helper', () => {
  test('returns true for normal errors', () => {
    const error = new Error('A normal error')
    expect(shouldReportErrorAsUnexpected(error)).toBe(true)
  })

  test('returns false for AbortError', () => {
    const error = new AbortError('An abort error')
    expect(shouldReportErrorAsUnexpected(error)).toBe(false)
  })

  test('returns true for BugError', () => {
    const error = new BugError('A bug error')
    expect(shouldReportErrorAsUnexpected(error)).toBe(true)
  })

  test('returns false for errors that imply environment issues', () => {
    const dnsError = new Error('getaddrinfo ENOTFOUND example.com')
    expect(shouldReportErrorAsUnexpected(dnsError)).toBe(false)

    const connectRefusedError = new Error('EACCES: permission denied, open /some/file')
    expect(shouldReportErrorAsUnexpected(connectRefusedError)).toBe(false)
  })

  test('returns true for errors with specific codes that are not environment issues', () => {
    // For errors that don't match environment issues, they should return true
    const error = new Error('Some other error')
    expect(shouldReportErrorAsUnexpected(error)).toBe(true)
  })
})

describe('AbortError', () => {
  test('initializes with message and tryMessage', () => {
    const message = 'Error message'
    const tryMessage = 'Try message'
    const error = new AbortError(message, tryMessage)

    expect(error.message).toBe(message)
    expect(error.tryMessage).toBe(tryMessage)
  })

  test('initializes with only message', () => {
    const message = 'Error message'
    const error = new AbortError(message)

    expect(error.message).toBe(message)
    expect(error.tryMessage).toBeNull()
  })

  test('has the correct type property', () => {
    const error = new AbortError('Error message')
    // FatalErrorType.Abort is 0
    expect(error.type).toBe(0)
  })
})

describe('BugError', () => {
  test('initializes with message', () => {
    const message = 'Error message'
    const error = new BugError(message)

    expect(error.message).toBe(message)
  })

  test('has the correct type property', () => {
    const error = new BugError('Error message')
    // FatalErrorType.Bug is 2
    expect(error.type).toBe(2)
  })
})
