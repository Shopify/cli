import {
  debugLogRequestInfo,
  extractGraphQLErrorMessages,
  errorHandler,
  extractGraphQLErrors,
  isMfaRequiredError,
} from './graphql.js'
import {GraphQLClientError} from './headers.js'
import {AbortError, MfaRequiredError} from '../../../public/node/error.js'
import {NEW_LOGIN_LABEL} from '../../../public/node/session-prompt.js'
import {runWithCommandEventsForCommand} from '../../../public/node/command-events.js'
import {withCapturedStandardStreams} from '../../../public/node/testing/output.js'
import * as localContext from '../../../public/node/context/local.js'
import {ClientError} from 'graphql-request'
import {describe, expect, test, vi} from 'vitest'

test('masks webhook secrets in diagnostics without changing request variables', async () => {
  const verbose = vi.spyOn(localContext, 'isVerbose').mockReturnValue(true)
  const variables = {sharedSecret: 'CURRENT_SECRET', shared_secret: 'LEGACY_SECRET'}
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        debugLogRequestInfo(
          'Webhooks',
          'mutation { cliTesting { success } }',
          'https://example.com/graphql',
          variables,
        ),
      )
      expect(stdout()).toBe('')
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'debug'})
      expect(stderr()).toContain('*****')
      expect(stderr()).not.toContain('CURRENT_SECRET')
      expect(stderr()).not.toContain('LEGACY_SECRET')
    })
  } finally {
    verbose.mockRestore()
  }
  expect(variables).toEqual({sharedSecret: 'CURRENT_SECRET', shared_secret: 'LEGACY_SECRET'})
})

describe('extractGraphQLErrorMessages', () => {
  test('returns undefined for undefined errors', () => {
    expect(extractGraphQLErrorMessages(undefined)).toBeUndefined()
  })

  test('returns undefined for empty errors array', () => {
    expect(extractGraphQLErrorMessages([])).toBeUndefined()
  })

  test('returns friendly message for access_denied app_errors', () => {
    const errors = [
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [
              {
                message: 'User does not have access to app_by_api_key.',
                category: 'access_denied',
              },
            ],
          },
        },
      },
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe(
      "You don't have the necessary permissions to perform this action. Check that you're using the correct account or token.",
    )
  })

  test('extracts raw message for non-access_denied app_errors', () => {
    const errors = [
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{message: 'Something else went wrong.', category: 'validation'}],
          },
        },
      },
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe('Something else went wrong.')
  })

  test('extracts multiple messages from extensions.app_errors', () => {
    const errors = [
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{message: 'First error.'}, {message: 'Second error.'}],
          },
        },
      },
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe('First error.\nSecond error.')
  })

  test('falls back to top-level error message when no app_errors', () => {
    const errors = [{message: 'Something went wrong'}]
    expect(extractGraphQLErrorMessages(errors)).toBe('Something went wrong')
  })

  test('handles multiple top-level errors', () => {
    const errors = [{message: 'Error one'}, {message: 'Error two'}]
    expect(extractGraphQLErrorMessages(errors)).toBe('Error one\nError two')
  })

  test('handles mix of app_errors and top-level errors', () => {
    const errors = [
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{message: 'Something broke.', category: 'validation'}],
          },
        },
      },
      {message: 'Another error'},
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe('Something broke.\nAnother error')
  })

  test('falls back to top-level message when app_errors.errors is empty', () => {
    const errors = [
      {
        message: 'Something went wrong',
        extensions: {
          app_errors: {
            errors: [],
          },
        },
      },
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe('Something went wrong')
  })

  test('falls back to top-level message when app_errors entries have no extractable message', () => {
    const errors = [
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{code: 'UNKNOWN'}],
          },
        },
      },
    ]
    expect(extractGraphQLErrorMessages(errors)).toBe('Query errors')
  })

  test('handles errors with no message', () => {
    const errors = [{code: 'UNKNOWN'}]
    expect(extractGraphQLErrorMessages(errors)).toBeUndefined()
  })
})

describe('isMfaRequiredError', () => {
  function clientErrorWithBody(body: Record<string, unknown>, status: number): ClientError {
    const response = {status, headers: new Map(), ...body} as unknown as ClientError['response']
    return new ClientError(response, {query: 'query {}'})
  }

  test('is true for a 401 whose errors carry the [TFA] marker', () => {
    const error = clientErrorWithBody(
      {errors: '[TFA] Unauthorized Access. This store requires two-factor authentication.'},
      401,
    )
    expect(isMfaRequiredError(error)).toBe(true)
  })

  test('is true for a 401 whose error text carries the [TFA] marker', () => {
    const error = clientErrorWithBody({error: '[TFA] Unauthorized Access.'}, 401)
    expect(isMfaRequiredError(error)).toBe(true)
  })

  test('is false for a 401 without the marker', () => {
    const error = clientErrorWithBody({errors: [{message: 'not authorized'}]}, 401)
    expect(isMfaRequiredError(error)).toBe(false)
  })

  test('is false for the marker on another status', () => {
    const error = clientErrorWithBody({errors: '[TFA] Unauthorized Access.'}, 403)
    expect(isMfaRequiredError(error)).toBe(false)
  })

  test('is false for an error that is not a ClientError', () => {
    expect(isMfaRequiredError(new Error('[TFA]'))).toBe(false)
  })
})

describe('errorHandler', () => {
  function createClientError(errors: unknown[], status = 200): ClientError {
    const response = {
      status,
      headers: new Map(),
      errors,
    } as unknown as ClientError['response']
    const error = new ClientError(response, {query: 'query {}'})
    return error
  }

  test('returns friendly message for access_denied app_errors', () => {
    const handler = errorHandler('App Management')
    const clientError = createClientError([
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{message: 'User does not have access to app_by_api_key.', category: 'access_denied'}],
          },
        },
      },
    ])
    const result = handler(clientError) as GraphQLClientError
    expect(result).toBeInstanceOf(GraphQLClientError)
    expect(result.message).toBe(
      "You don't have the necessary permissions to perform this action. Check that you're using the correct account or token.",
    )
  })

  test('falls back to JSON dump when no extractable messages', () => {
    const handler = errorHandler('App Management')
    const clientError = createClientError([{code: 'UNKNOWN'}])
    const result = handler(clientError) as GraphQLClientError
    expect(result).toBeInstanceOf(GraphQLClientError)
    expect(result.message).toContain('App Management GraphQL API responded unsuccessfully')
  })

  test('asks for a login with multi-factor authentication when the API requires it', () => {
    const handler = errorHandler('Business Platform Organizations')
    const response = {
      status: 401,
      headers: new Map(),
      errors: '[TFA] Unauthorized Access. This store requires two-factor authentication.',
    } as unknown as ClientError['response']

    const result = handler(new ClientError(response, {query: 'query {}'}), 'req-123') as MfaRequiredError

    expect(result).toBeInstanceOf(MfaRequiredError)
    expect(result).toBeInstanceOf(AbortError)
    expect(result.code).toBe('MFA_REQUIRED')
    expect(result.tryMessage).toContain(NEW_LOGIN_LABEL)
    expect(result).not.toHaveProperty('statusCode')
    expect(result.message).toBe(
      'This action requires you to log in with a secure method, like a passkey or two-step authentication.\n\nRequest ID: req-123',
    )
    expect(result.tryMessage).toBe(
      "Set up a passkey or two-step authentication for your Shopify account if you haven't already, sign out of Shopify in your browser, then run `shopify auth login` and select 'Log in with a different account'.",
    )
    expect(JSON.stringify(result)).not.toContain('Business Platform')
    expect(JSON.stringify(result)).not.toContain('shopify auth logout')
  })

  test('appends request ID when provided', () => {
    const handler = errorHandler('App Management')
    const clientError = createClientError([
      {
        message: 'Query errors',
        extensions: {
          app_errors: {
            errors: [{message: 'Something broke.', category: 'validation'}],
          },
        },
      },
    ])
    const result = handler(clientError, 'req-123') as GraphQLClientError
    expect(result.message).toContain('Something broke.')
    expect(result.message).toContain('Request ID: req-123')
  })

  test('returns AbortError for 5xx status with API context', () => {
    const handler = errorHandler('App Management')
    const clientError = createClientError([{message: 'Internal server error'}], 500)
    const result = handler(clientError) as AbortError
    expect(result).toBeInstanceOf(AbortError)
    expect(result.message).toBe('The App Management GraphQL API responded with HTTP status 500: Internal server error')
  })

  test('passes through non-ClientError errors', () => {
    const handler = errorHandler('App Management')
    const error = new Error('something else')
    expect(handler(error)).toBe(error)
  })
})

describe('extractGraphQLErrors', () => {
  const graphQLErrors = [{message: 'Challenge Required', extensions: {code: 'CHALLENGE_REQUIRED'}}]
  const clientError = new ClientError(
    {status: 200, headers: new Map(), errors: graphQLErrors} as unknown as ClientError['response'],
    {query: 'query {}'},
  )

  test('returns the same GraphQL errors before and after errorHandler maps the error', () => {
    const mappedError = errorHandler('Admin')(clientError, 'req-123')

    expect(mappedError).toBeInstanceOf(GraphQLClientError)
    expect(extractGraphQLErrors(clientError)).toEqual(graphQLErrors)
    expect(extractGraphQLErrors(mappedError)).toEqual(graphQLErrors)
  })

  test('returns no GraphQL errors for an error that is not a GraphQL error', () => {
    expect(extractGraphQLErrors(new AbortError('Network error'))).toEqual([])
  })
})
