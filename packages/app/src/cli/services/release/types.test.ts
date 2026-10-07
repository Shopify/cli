import {appReleaseJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const version = {
  gid: 'gid://shopify/Version/123',
  name: 'v1',
  message: null,
  url: 'https://dev.shopify.com/dashboard/1/apps/1/versions/123',
}
const result = {status: 'success' as const, app: {name: 'Example', clientId: 'client-id'}, release: {version}}

describe('appReleaseJsonOutputSchema', () => {
  test('encodes success and unavailable version fields', () => {
    const value = {...result, release: {version: {...version, name: null}}}
    expect(JSON.parse(appReleaseJsonOutputSchema.encode(value))).toEqual(value)
  })

  test('encodes cancellation without a release', () => {
    expect(JSON.parse(appReleaseJsonOutputSchema.encode({status: 'cancelled'}))).toEqual({status: 'cancelled'})
  })

  test.each([
    {...result, status: 'unknown'},
    {...result, app: {...result.app, apiSecret: 'secret'}},
    {...result, app: {...result.app, clientId: ''}},
    {...result, release: {...result.release, internalId: 'internal'}},
    {...result, release: {version: {...version, gid: '123'}}},
    {...result, release: {version: {...version, url: 'not-a-url'}}},
    {...result, release: {version: {...version, name: ''}}},
    {...result, release: {version: {...version, message: ''}}},
    {...result, release: {version: {...version, id: 123}}},
    {status: 'cancelled', release: {version}},
  ])('rejects invalid CLI-owned fields: %j', (value) => {
    expect(() => appReleaseJsonOutputSchema.validate(value)).toThrow()
  })
})
