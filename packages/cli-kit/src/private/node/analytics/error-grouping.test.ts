import {errorGroupingHash, errorGroupingSignals} from './error-grouping.js'
import {GraphQLClientError} from '../api/headers.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError} from 'graphql-request'
import {describe, expect, test} from 'vitest'

function clientError(status: number, code?: string): ClientError {
  const errors = code ? [{message: 'boom', extensions: {code}}] : undefined
  return new ClientError({status, errors, headers: {}} as any, {query: 'q'} as any)
}

describe('errorGroupingSignals', () => {
  test('reads status, code, and class from a GraphQLClientError', () => {
    const error = new GraphQLClientError('Forbidden', 403, [{extensions: {code: 'ACCESS_DENIED'}}])

    expect(errorGroupingSignals(error)).toEqual({
      httpStatus: 403,
      code: 'ACCESS_DENIED',
      errorClass: 'GraphQLClientError',
    })
  })

  test('reads status and code from a raw graphql-request ClientError', () => {
    const error = clientError(429, 'THROTTLED')

    expect(errorGroupingSignals(error)).toEqual({
      httpStatus: 429,
      code: 'THROTTLED',
      errorClass: 'ClientError',
    })
  })

  test('returns only the class name for a generic Error', () => {
    expect(errorGroupingSignals(new Error('boom'))).toEqual({errorClass: 'Error'})
  })

  test('returns an empty object for a non-Error value', () => {
    expect(errorGroupingSignals('boom')).toEqual({})
  })

  test('ignores a non-array errors value', () => {
    const error = new GraphQLClientError('weird', 400, 'not-an-array' as any)

    expect(errorGroupingSignals(error)).toEqual({httpStatus: 400, errorClass: 'GraphQLClientError'})
  })
})

describe('errorGroupingHash — structured decision table', () => {
  test.each<[string, ClientError | GraphQLClientError, string]>([
    ['THROTTLED code -> rate_limit', clientError(400, 'THROTTLED'), 'theme:rate_limit:http-400-throttled'],
    ['HTTP 429 -> rate_limit', clientError(429), 'theme:rate_limit:http-429'],
    ['HTTP 401 -> authentication', clientError(401), 'theme:authentication:http-401'],
    ['HTTP 403 -> permission', clientError(403), 'theme:permission:http-403'],
    ['ACCESS_DENIED code -> permission', clientError(400, 'ACCESS_DENIED'), 'theme:permission:http-400-access-denied'],
    ['HTTP 500 -> server', clientError(500), 'theme:server:http-500'],
    ['HTTP 503 -> server', clientError(503), 'theme:server:http-503'],
  ])('%s', (_, error, expected) => {
    expect(errorGroupingHash(error, 'theme')).toEqual(expected)
  })

  test('403 wins over a 401-looking authentication category (permission, not authentication)', () => {
    const error = new GraphQLClientError('Forbidden', 403, [{extensions: {code: 'ACCESS_DENIED'}}])

    expect(errorGroupingHash(error, 'store')).toEqual('store:permission:http-403-access-denied')
  })

  test('prefixes the hash with the provided slice name', () => {
    expect(errorGroupingHash(clientError(429), 'app')).toEqual('app:rate_limit:http-429')
    expect(errorGroupingHash(clientError(429), 'cli')).toEqual('cli:rate_limit:http-429')
  })
})

describe('errorGroupingHash — message fallback', () => {
  test('recovers an HTTP status flattened into an AbortError message', () => {
    const error = new AbortError('The request responded unsuccessfully with the HTTP status 500')

    expect(errorGroupingHash(error, 'theme')).toEqual('theme:server:http-500')
  })

  test('recovers a graphql-request style "(Code: NNN)" status from a message', () => {
    const error = new Error('GraphQL Error (Code: 401): {"response":{"status":401}}')

    expect(errorGroupingHash(error, 'store')).toEqual('store:authentication:http-401')
  })

  test('falls back to the keyword categorizer for an untyped, signal-less error', () => {
    const error = new Error('connect ETIMEDOUT 1.2.3.4:443')
    const hash = errorGroupingHash(error, 'cli')

    expect(hash).toMatch(/^cli:network:/)
  })

  test('returns undefined for an unknown error so stack-trace grouping is preserved', () => {
    expect(errorGroupingHash(new Error('something nobody has categorized'), 'cli')).toBeUndefined()
  })

  test('returns undefined for a non-Error value', () => {
    expect(errorGroupingHash(undefined, 'cli')).toBeUndefined()
  })
})
