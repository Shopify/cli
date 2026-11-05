import {appConfigLinkJsonOutputSchema, projectAppConfigResult} from './types.js'
import {testOrganizationApp} from '../../../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

function result() {
  return projectAppConfigResult({
    path: '/app/shopify.app.toml',
    appName: 'Example',
    app: testOrganizationApp({apiKey: 'key', developmentStorePreviewEnabled: false}),
  })
}

describe('config link result', () => {
  test('returns only the written path and app identity', () => {
    const encoded = JSON.parse(appConfigLinkJsonOutputSchema.encode(result()))
    expect(Object.keys(encoded)).toEqual(['path', 'app'])
    expect(encoded.app).toEqual({
      id: '1',
      gid: null,
      name: 'Example',
      clientId: 'key',
      organizationId: '1',
      organizationGid: null,
    })
  })

  test('separates actual GIDs from other app and organization identifiers', () => {
    const value = projectAppConfigResult({
      path: '/app/shopify.app.toml',
      appName: 'Example',
      app: testOrganizationApp({id: 'gid://shopify/App/123', organizationId: 'gid://shopify/Organization/456'}),
    })
    expect(value.app).toMatchObject({
      id: null,
      gid: 'gid://shopify/App/123',
      organizationId: null,
      organizationGid: 'gid://shopify/Organization/456',
    })
    expect(result().app).toMatchObject({id: '1', gid: null, organizationId: '1', organizationGid: null})
  })

  test.each([
    {path: 'relative.toml'},
    {extra: true},
    {app: {...result().app, extra: true}},
    {app: {...result().app, redirectUrls: null}},
    {app: {...result().app, gid: 'gid://shopify/Shop/123'}},
  ])('rejects malformed public projections %j', (fields) => {
    expect(() => appConfigLinkJsonOutputSchema.validate({...result(), ...fields})).toThrow()
  })

  test('rejects a missing app client ID', () => {
    expect(() => appConfigLinkJsonOutputSchema.validate({...result(), app: {...result().app, clientId: ''}})).toThrow()
  })
})
