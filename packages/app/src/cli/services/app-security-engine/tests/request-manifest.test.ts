import {parseRequestManifest, REQUEST_AUTHENTICATION_METHODS, RequestManifestError} from '../dynamic/requests.js'
import {describe, expect, test} from 'vitest'

describe('App Security request manifest', () => {
  test('accepts every supported authentication method', () => {
    const requests = REQUEST_AUTHENTICATION_METHODS.map((method, index) => ({url: `/endpoint/${index}`, method}))

    expect(parseRequestManifest({schema_version: 1, requests})).toEqual({schema_version: 1, requests})
  })

  test.each([
    null,
    {},
    {schema_version: 2, requests: []},
    {schema_version: 1, requests: 'not-an-array'},
    {schema_version: 1, requests: [{url: 'https://production.example/webhook', method: 'webhook'}]},
    {schema_version: 1, requests: [{url: '//production.example/webhook', method: 'webhook'}]},
    {schema_version: 1, requests: [{url: '/webhook?token=secret', method: 'webhook'}]},
    {schema_version: 1, requests: [{url: '/webhook', method: 'unknown'}]},
    {
      schema_version: 1,
      requests: [
        {url: '/webhook', method: 'webhook'},
        {url: '/webhook', method: 'webhook'},
      ],
    },
  ])('rejects an unsafe or malformed manifest %#', (manifest) => {
    expect(() => parseRequestManifest(manifest)).toThrow(RequestManifestError)
  })

  test('bounds the number of endpoints', () => {
    const requests = Array.from({length: 1_001}, (_, index) => ({url: `/webhook/${index}`, method: 'webhook'}))

    expect(() => parseRequestManifest({schema_version: 1, requests})).toThrow(/more than 1000 requests/)
  })
})
