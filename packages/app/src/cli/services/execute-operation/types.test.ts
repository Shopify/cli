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

  test.each([
    {},
    {data: []},
    {data: {}, errors: []},
    {data: {}, extensions: []},
    {path: 'result.json', format: 'json'},
    {path: joinPath(cwd(), 'result.json'), format: 'jsonl'},
    {path: joinPath(cwd(), 'result.json'), format: 'json', data: {}},
  ])('rejects an invalid CLI wrapper: %j', (result) => {
    expect(() => appExecuteJsonOutputSchema.validate(result)).toThrow()
  })
})
