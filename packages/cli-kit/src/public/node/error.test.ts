import {
  AbortError,
  AbortSilentError,
  BugError,
  ExternalError,
  handler,
  cleanSingleStackTracePath,
  shouldReportErrorAsUnexpected,
} from './error.js'
import {renderFatalError} from './ui.js'
import {jsonOutputEnabled} from './environment.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {ClientError} from 'graphql-request'
import {describe, expect, test, vi} from 'vitest'

function clientError(status: number, code?: string): ClientError {
  const errors = code ? [{message: 'boom', extensions: {code}}] : undefined
  return new ClientError({status, errors, headers: {}} as any, {query: 'q'} as any)
}

vi.mock('./ui.js')
vi.mock('./environment.js')

/**
 * `jsonOutputEnabled` reads `process.argv` and the environment, both of which are global.
 * Mocking it keeps these tests independent of how vitest was invoked; the detection logic
 * itself is covered by the `sniffForJson` tests in `path.test.ts`.
 */
function givenJsonOutputIs(enabled: boolean): ReturnType<typeof mockAndCaptureOutput> {
  vi.mocked(jsonOutputEnabled).mockReturnValue(enabled)
  const outputMock = mockAndCaptureOutput()
  outputMock.clear()
  return outputMock
}

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

describe('handler with JSON output active', () => {
  test('writes a JSON error document and renders no banner', async () => {
    // Given
    const outputMock = givenJsonOutputIs(true)

    // When
    await handler(new AbortError('boom', 'try this'))

    // Then
    expect(JSON.parse(outputMock.info())).toStrictEqual({
      error: {type: 'abort', message: 'boom', tryMessage: 'try this'},
    })
    expect(renderFatalError).not.toHaveBeenCalled()
    expect(outputMock.error()).toBe('')
  })

  test('renders the banner and no JSON when JSON output is inactive', async () => {
    // Given
    const outputMock = givenJsonOutputIs(false)
    const error = new AbortError('boom')

    // When
    await handler(error)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(error)
    expect(outputMock.info()).toBe('')
  })

  test.each([
    ['a string', 'a plain string failure', 'a plain string failure'],
    ['an Error', new Error('a real error'), 'a real error'],
    ['a non-Error object', {message: 'a duck-typed failure'}, 'a duck-typed failure'],
    ['an object with no message at all', {}, 'Unknown error'],
  ])('reports %s thrown by a command as a bug', async (_label, thrown, expectedMessage) => {
    // Given
    const outputMock = givenJsonOutputIs(true)

    // When
    await handler(thrown)

    // Then
    const {error} = JSON.parse(outputMock.info())
    expect(error.type).toBe('bug')
    expect(error.message).toBe(expectedMessage)
  })

  test('distinguishes an ExternalError from an AbortError', async () => {
    // Given
    const outputMock = givenJsonOutputIs(true)

    // When
    await handler(new ExternalError('boom', 'npm', ['install']))

    // Then
    expect(JSON.parse(outputMock.info()).error).toStrictEqual({
      type: 'external',
      message: 'boom',
      command: 'npm',
      args: ['install'],
    })
  })

  test('stays silent for an AbortSilentError, which exists to print nothing', async () => {
    // Given
    const outputMock = givenJsonOutputIs(true)

    // When
    await handler(new AbortSilentError())

    // Then
    expect(outputMock.output()).toBe('')
    expect(renderFatalError).not.toHaveBeenCalled()
  })

  test('writes the document before resolving, so it lands before oclif calls process.exit', async () => {
    // `BaseCommand.catch` awaits `errorHandler` and only then calls `Errors.handle`, which
    // exits the process. The document being present the moment `handler` resolves is
    // therefore what guarantees it is never lost to the exit.
    // Given
    const outputMock = givenJsonOutputIs(true)

    // When
    await handler(new AbortError('boom'))

    // Then
    expect(outputMock.info()).not.toBe('')
  })

  test('falls back to the banner and still resolves when serialization throws', async () => {
    // A throw here must not propagate: `errorHandler` reports the error to analytics only
    // after `handler` resolves, so rethrowing would silently kill crash reporting.
    // A malformed token is the realistic trigger: `tokenItemToString` falls through to its
    // array branch for an unrecognised shape and throws on `.map`.
    // Given
    const outputMock = givenJsonOutputIs(true)
    const error = new AbortError('boom', {unrecognisedToken: true} as unknown as string)

    // When
    await expect(handler(error)).resolves.toBe(error)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(error)
    expect(outputMock.info()).toBe('')
  })

  test('leaves the exit code oclif will use untouched', async () => {
    // Given
    givenJsonOutputIs(true)
    const error = new AbortError('boom') as AbortError & {oclif: {exit: number}}
    error.oclif = {exit: 2}

    // When
    await handler(error)

    // Then
    expect(error.oclif.exit).toBe(2)
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
