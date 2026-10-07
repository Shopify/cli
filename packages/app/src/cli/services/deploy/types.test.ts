import {appDeployJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const deployment = {
  released: true,
  version: {
    gid: 'gid://shopify/Version/123',
    name: 'v1',
    message: null,
    url: 'https://dev.shopify.com/dashboard/1/apps/1/versions/123',
  },
}
const result = {status: 'success' as const, app: {name: 'Example', clientId: 'client-id'}, deployment}

describe('appDeployJsonOutputSchema', () => {
  test('encodes success and unavailable version fields', () => {
    const value = {...result, deployment: {...deployment, version: {...deployment.version, name: null}}}
    expect(JSON.parse(appDeployJsonOutputSchema.encode(value))).toEqual(value)
  })

  test('encodes partial release with the created version and errors', () => {
    const value = {
      ...result,
      status: 'partial' as const,
      deployment: {...deployment, released: false as const},
      errors: [{type: 'abort' as const, message: 'Version could not be released.'}],
    }
    expect(JSON.parse(appDeployJsonOutputSchema.encode(value))).toEqual(value)
  })

  test('encodes cancellation without a deployment', () => {
    expect(JSON.parse(appDeployJsonOutputSchema.encode({status: 'cancelled'}))).toEqual({status: 'cancelled'})
  })

  test.each([
    {...result, status: 'unknown'},
    {...result, app: {...result.app, apiSecret: 'secret'}},
    {...result, deployment: {...deployment, internalId: 'internal'}},
    {...result, deployment: {...deployment, version: {...deployment.version, gid: '123'}}},
    {...result, deployment: {...deployment, version: {...deployment.version, url: 'not-a-url'}}},
    {...result, deployment: {...deployment, version: {...deployment.version, id: 123}}},
    {...result, status: 'partial', errors: []},
    {...result, status: 'partial', errors: [{type: 'abort', message: 'Release failed.'}]},
    {status: 'cancelled', deployment},
  ])('rejects invalid CLI-owned fields: %j', (value) => {
    expect(() => appDeployJsonOutputSchema.validate(value)).toThrow()
  })
})
