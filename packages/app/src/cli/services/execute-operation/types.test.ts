import {appExecuteJsonOutputSchema} from './types.js'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('appExecuteJsonOutputSchema', () => {
  test.each([
    {data: {}},
    {data: null},
    {data: {aliased_shop: {name: 'Café', active: false}, products: [], missing: null}},
    {data: {}, extensions: {cost: {requestedQueryCost: 1}}},
    {path: joinPath(cwd(), 'result.json'), format: 'json' as const},
  ])('encodes the native query result or file receipt: %j', (result) => {
    expect(JSON.parse(appExecuteJsonOutputSchema.encode(result))).toEqual(result)
  })

  test('preserves native own keys and their order through validation and encoding', () => {
    const native = JSON.parse('{"__proto__":false,"constructor":null,"nested":{"__proto__":"value"}}')
    const result = {data: native, extensions: native}
    const validated = appExecuteJsonOutputSchema.validate(result)
    if (!('data' in validated)) throw new Error('Expected a GraphQL result')
    for (const payload of [validated.data, validated.extensions]) {
      expect(Object.hasOwn(payload ?? {}, '__proto__')).toBe(true)
      expect(Object.hasOwn(payload ?? {}, 'constructor')).toBe(true)
    }
    expect(JSON.stringify(validated)).toBe(JSON.stringify(result))
    expect(appExecuteJsonOutputSchema.encode(result)).toBe(JSON.stringify(result, null, 2))
  })

  test.each([
    {},
    {data: []},
    {data: 'invalid'},
    {data: 1},
    {data: false},
    {data: undefined},
    {data: {}, errors: []},
    JSON.parse('{"data":{},"__proto__":"outside-native-payload"}'),
    {data: {}, extensions: []},
    {data: {}, extensions: null},
    {data: {}, extensions: 'invalid'},
    {data: {}, extensions: 1},
    {data: {}, extensions: false},
    {path: 'result.json', format: 'json'},
    {path: joinPath(cwd(), 'result.json'), format: 'jsonl'},
    {path: joinPath(cwd(), 'result.json'), format: 'json', data: {}},
  ])('rejects an invalid CLI wrapper: %j', (result) => {
    expect(() => appExecuteJsonOutputSchema.validate(result)).toThrow()
  })

  test('declares data as required object or null and extensions as an optional object in JSON Schema', () => {
    const resultSchema = appExecuteJsonOutputSchema.jsonSchema.definitions?.AppExecuteGraphQLResult
    expect(resultSchema).toMatchObject({
      type: 'object',
      properties: {
        data: {anyOf: [{allOf: [{}, {type: 'object', additionalProperties: {}}]}, {type: 'null'}]},
        extensions: {$ref: expect.stringContaining('properties/data/anyOf/0')},
      },
      required: ['data'],
      additionalProperties: false,
    })
  })
})
