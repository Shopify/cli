import {defineThemeJsonOutputSchema, projectTheme, storeDomain, themeId} from './schema.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {describe, expect, test} from 'vitest'

describe('themeId', () => {
  test.each([
    ['a decimal string', '123', '123'],
    ['a number', 123, '123'],
    ['zero', 0, '0'],
  ])('accepts %s', (_label, value, expected) => {
    expect(themeId(value)).toBe(expected)
  })

  test.each([
    ['a GID', 'gid://shopify/OnlineStoreTheme/123'],
    ['a negative string', '-1'],
    ['an empty string', ''],
    ['a negative number', -1],
    ['a fractional number', 1.5],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s', (_label, value) => {
    expect(() => themeId(value)).toThrow()
  })
})

describe('storeDomain', () => {
  test('keeps a myshopify.com domain', () => {
    expect(storeDomain('my-shop.myshopify.com')).toBe('my-shop.myshopify.com')
  })

  test.each([
    ['a custom domain', 'custom.example.com'],
    ['a subdomain of a shop', 'a.b.myshopify.com'],
    ['an uppercased domain', 'My-Shop.myshopify.com'],
    ['the unconfigured placeholder', 'Not configured'],
    ['an empty string', ''],
    ['undefined', undefined],
    ['null', null],
  ])('reports %s as unavailable', (_label, value) => {
    expect(storeDomain(value)).toBeNull()
  })
})

describe('projectTheme', () => {
  test('keeps only the public fields and stringifies the ID', () => {
    expect(projectTheme({id: 7, name: 'My theme', role: 'live', shop: 'my-shop.myshopify.com'} as never)).toEqual({
      id: '7',
      name: 'My theme',
      role: 'live',
    })
  })
})

describe('defineThemeJsonOutputSchema', () => {
  const outputSchema = defineThemeJsonOutputSchema({
    name: 'ThemeProbe',
    schema: zod.object({id: zod.string()}).strict(),
    project: (value) => ({id: themeId((value as {id: number}).id)}),
  })

  test('projects a single result', () => {
    expect(JSON.parse(outputSchema.encode({id: 7}))).toEqual({id: '7'})
  })

  test('projects each successful environment and passes errors through untouched', () => {
    const encoded = outputSchema.encode({
      environments: [
        {environment: 'production', result: {id: 7}},
        {environment: 'failed', error: {type: 'abort', message: 'Authentication failed'}},
      ],
    })

    expect(JSON.parse(encoded)).toEqual({
      environments: [
        {environment: 'production', result: {id: '7'}},
        {environment: 'failed', error: {type: 'abort', message: 'Authentication failed'}},
      ],
    })
  })

  test.each([
    ['on its own', {status: 'cancelled'}, {status: 'cancelled'}],
    [
      'inside a batch',
      {environments: [{environment: 'production', result: {status: 'cancelled'}}]},
      {environments: [{environment: 'production', result: {status: 'cancelled'}}]},
    ],
  ])('leaves a cancellation unprojected %s', (_label, value, expected) => {
    expect(JSON.parse(outputSchema.encode(value))).toEqual(expected)
  })
})
