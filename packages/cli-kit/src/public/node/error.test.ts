import {AbortError, BugError, handler, cleanSingleStackTracePath, shouldReportErrorAsUnexpected} from './error.js'
import {renderFatalError} from './ui.js'
import {ClientError} from 'graphql-request'
import {describe, expect, test, vi} from 'vitest'

function clientError(status: number, code?: string): ClientError {
  const errors = code ? [{message: 'boom', extensions: {code}}] : undefined
  return new ClientError({status, errors, headers: {}} as any, {query: 'q'} as any)
}

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

  test('returns false for user-aborted requests', () => {
    expect(shouldReportErrorAsUnexpected(new Error('The user aborted a request.'))).toBe(false)
  })

  test('returns false for EPIPE errors', () => {
    expect(shouldReportErrorAsUnexpected(new Error('write EPIPE'))).toBe(false)
  })

  test('returns false for unsupported platform errors', () => {
    expect(shouldReportErrorAsUnexpected(new Error('Unsupported platform: win32 arm64 LE'))).toBe(false)
  })

  test('returns false for a raw ClientError that is rate limited (HTTP 429)', () => {
    expect(shouldReportErrorAsUnexpected(clientError(429))).toBe(false)
  })

  test('returns false for a raw ClientError that is unauthenticated (HTTP 401)', () => {
    expect(shouldReportErrorAsUnexpected(clientError(401))).toBe(false)
  })

  test('returns false for a raw ClientError with a THROTTLED code', () => {
    expect(shouldReportErrorAsUnexpected(clientError(400, 'THROTTLED'))).toBe(false)
  })

  test('returns false for a raw ClientError with a GraphQL "429" code at HTTP 200', () => {
    // Matches errorsIncludeStatus429 in private/node/api.ts.
    expect(shouldReportErrorAsUnexpected(clientError(200, '429'))).toBe(false)
  })

  test('returns false for a rate-limit code on a later error entry, not just the first', () => {
    const error = new ClientError(
      {status: 200, errors: [{message: 'noise'}, {extensions: {code: 'THROTTLED'}}], headers: {}} as any,
      {query: 'q'} as any,
    )
    expect(shouldReportErrorAsUnexpected(error)).toBe(false)
  })

  test('returns true for a raw ClientError that is a genuine failure (HTTP 500)', () => {
    expect(shouldReportErrorAsUnexpected(clientError(500))).toBe(true)
  })
})
