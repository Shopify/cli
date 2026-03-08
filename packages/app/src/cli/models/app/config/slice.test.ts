import {sliceConfigForSpec, findUnclaimedKeys} from './slice.js'
import {ExtensionSpecification} from '../../extensions/specification.js'
import {describe, expect, test} from 'vitest'

function specWithKeys(id: string, keys: string[]): ExtensionSpecification {
  return {declaredKeys: keys, identifier: id} as unknown as ExtensionSpecification
}

describe('sliceConfigForSpec', () => {
  test('picks only declared keys present in raw config', () => {
    const raw = {name: 'my-app', application_url: 'https://example.com', client_id: '123'}
    const spec = specWithKeys('app_home', ['name', 'application_url', 'embedded', 'app_preferences'])

    const slice = sliceConfigForSpec(raw, spec)

    expect(slice).toEqual({name: 'my-app', application_url: 'https://example.com'})
    // embedded and app_preferences are declared but not in raw — excluded
    expect(slice).not.toHaveProperty('embedded')
    expect(slice).not.toHaveProperty('client_id')
  })

  test('returns empty object when no declared keys are in raw', () => {
    const raw = {client_id: '123', build: {}}
    const spec = specWithKeys('point_of_sale', ['pos', 'name', 'type'])

    expect(sliceConfigForSpec(raw, spec)).toEqual({})
  })

  test('deep copies values so mutations do not affect original', () => {
    const raw = {webhooks: {api_version: '2024-01', subscriptions: [{uri: '/test'}]}}
    const spec = specWithKeys('webhooks', ['webhooks'])

    const slice = sliceConfigForSpec(raw, spec) as {webhooks: {subscriptions: {uri: string}[]}}
    slice.webhooks.subscriptions[0]!.uri = '/mutated'

    // Original is untouched
    expect(raw.webhooks.subscriptions[0]!.uri).toBe('/test')
  })

  test('handles nested objects correctly', () => {
    const raw = {
      access_scopes: {scopes: 'read_products', use_legacy_install_flow: false},
      auth: {redirect_urls: ['https://example.com/callback']},
      client_id: '123',
    }
    const spec = specWithKeys('app_access', ['access_scopes', 'auth'])

    const slice = sliceConfigForSpec(raw, spec)

    expect(slice).toEqual({
      access_scopes: {scopes: 'read_products', use_legacy_install_flow: false},
      auth: {redirect_urls: ['https://example.com/callback']},
    })
  })
})

describe('findUnclaimedKeys', () => {
  test('returns keys not claimed by any spec or AppSchema', () => {
    const raw = {
      client_id: '123',
      name: 'my-app',
      unknown_section: {foo: 'bar'},
      another_unknown: true,
    }
    const slices: [string, object][] = [
      ['branding', {name: 'my-app'}],
    ]

    const unclaimed = findUnclaimedKeys(raw, slices)

    // client_id is in AppSchema — claimed
    // name is in branding slice — claimed
    // unknown_section and another_unknown are unclaimed
    expect(unclaimed.sort()).toEqual(['another_unknown', 'unknown_section'])
  })

  test('returns empty array when all keys are claimed', () => {
    const raw = {client_id: '123', name: 'my-app'}
    const slices: [string, object][] = [['branding', {name: 'my-app'}]]

    expect(findUnclaimedKeys(raw, slices)).toEqual([])
  })

  test('organization_id is always claimed', () => {
    const raw = {client_id: '123', organization_id: 'org-1'}
    const slices: [string, object][] = []

    expect(findUnclaimedKeys(raw, slices)).toEqual([])
  })
})
