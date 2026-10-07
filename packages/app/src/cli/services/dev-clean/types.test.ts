import {appDevCleanJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'

const result = {
  status: 'success',
  app: {name: 'Test App', clientId: 'public-client-id'},
  storeDomain: 'test-store.myshopify.com',
} as const

test('encodes the public success result', () => {
  expect(JSON.parse(appDevCleanJsonOutputSchema.encode(result))).toEqual(result)
})

test('accepts the canonical local development hostname', () => {
  const localResult = {...result, storeDomain: 'test-store.my.shop.dev'}
  expect(JSON.parse(appDevCleanJsonOutputSchema.encode(localResult))).toEqual(localResult)
})

test.each([
  {...result, status: 'failed'},
  {...result, changed: true},
  {...result, app: {...result.app, clientId: ''}},
  {...result, app: {...result.app, name: null}},
  {...result, app: {...result.app, apiSecretKeys: ['private']}},
  {...result, storeDomain: 'https://test-store.myshopify.com'},
  {...result, storeDomain: 'test-store.myshopify.com/admin'},
  {...result, storeDomain: 'test-store.myshopify.com:443'},
  {...result, storeDomain: 'test-store..myshopify.com'},
  {...result, storeDomain: 'Test-Store.myshopify.com'},
])('rejects an invalid public result: %j', (input) => {
  expect(() => appDevCleanJsonOutputSchema.validate(input)).toThrow()
})
