import {AbortError, ExternalError} from './index.js'
import {errorToJson} from './serialization.js'
import {GraphQLClientError} from '../../../private/node/api/headers.js'
import {expect, test} from 'vitest'

test('preserves account-switching guidance for GraphQL HTTP 403 errors', () => {
  const error = Object.assign(new GraphQLClientError('Forbidden', 403), {
    accessToken: 'secret',
    request: {authorization: 'secret'},
  })

  expect(errorToJson(error)).toEqual({
    type: 'abort',
    message: 'Forbidden',
    tryMessage: 'Ensure you are using the correct account. You can switch with `shopify auth login`',
  })
})

test('preserves recovery fields and selected details without copying arbitrary properties', () => {
  const error = Object.assign(
    new AbortError(
      'Failed',
      [{command: 'shopify auth login'}],
      ['Retry the command'],
      [{title: 'Account', body: 'Select an account with app access'}],
    ),
    {details: {operationGid: 'gid://shopify/AppSubscriptionMigrationOperation/one'}, accessToken: 'secret'},
  )

  expect(errorToJson(error)).toEqual({
    type: 'abort',
    message: 'Failed',
    tryMessage: 'shopify auth login',
    nextSteps: ['Retry the command'],
    customSections: [{title: 'Account', body: 'Select an account with app access'}],
    details: {operationGid: 'gid://shopify/AppSubscriptionMigrationOperation/one'},
  })
})

test('preserves the external error classification and command', () => {
  expect(errorToJson(new ExternalError('Failed', 'npm', ['install']))).toEqual({
    type: 'external',
    message: 'Failed',
    command: 'npm',
    args: ['install'],
  })
})

test.each(['Failed', null, undefined])('projects thrown primitives into bug errors: %s', (source) => {
  expect(errorToJson(source)).toEqual({type: 'bug', message: source ?? 'Unknown error'})
})
