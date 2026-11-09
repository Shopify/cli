import {discoverLogTypes, logTypesJsonOutputSchema} from './type-discovery.js'
import {logFilters, selectedLogTypes} from './catalog.js'
import {prepareLogInput} from './input.js'
import {describe, expect, test} from 'vitest'

test('discovers the complete retrieval catalog without exposing backend names', () => {
  const result = discoverLogTypes()
  expect(result.types.map(({name}) => name)).toEqual(['webhook', 'graphql'])
  expect(result.types.map(({name}) => name)).toEqual(selectedLogTypes().map(({name}) => name))
  for (const type of result.types) {
    expect(type).not.toHaveProperty('backend')
    expect(type.filters.every((filter) => logFilters.some(({flag}) => flag === filter))).toBe(true)
  }
})

test.each(['webhook', 'graphql'])('selects %s without depending on emitted records', (name) => {
  const result = discoverLogTypes(name)
  expect(result.types).toHaveLength(1)
  expect(result.types[0]).toMatchObject({name})
  expect(result.types[0]?.example).toContain(`shopify app logs-next --type ${name}`)
})

test('describes implemented exact-value filters without claiming repeated-value OR support', () => {
  expect(discoverLogTypes('webhook').types[0]?.filters).toEqual(['store', 'status', 'topic', 'status-code'])
  expect(discoverLogTypes('graphql').types[0]?.filters).toEqual([
    'store',
    'status',
    'operation-type',
    'operation-name',
    'request-id',
  ])
  expect(
    prepareLogInput({type: 'webhook', status: 'failure', topic: 'orders/create', 'status-code': '500'}).filters,
  ).toEqual([
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    {field: 'STATUS_CODE', operator: 'EQUALS', value: '500'},
  ])
  expect(() => prepareLogInput({'status-code': '5xx'})).toThrow('exact code from 100 to 599')
  expect(() => prepareLogInput({topic: 'orders'})).toThrow('exact slash-form topic')
})

describe('strict public schema', () => {
  test('accepts the all-types and selected-type projections', () => {
    for (const name of [undefined, 'webhook', 'graphql']) {
      const result = discoverLogTypes(name)
      expect(JSON.parse(logTypesJsonOutputSchema.encode(result))).toEqual(result)
    }
  })

  test('rejects extra envelope and type fields', () => {
    const result = discoverLogTypes('webhook')
    expect(() => logTypesJsonOutputSchema.validate({...result, clientId: 'not-app-scoped'})).toThrow()
    expect(() => logTypesJsonOutputSchema.validate({types: [{...result.types[0], backend: 'WEBHOOK'}]})).toThrow()
  })

  test('requires metadata and rejects unsupported names and filters', () => {
    const type = discoverLogTypes('webhook').types[0]!
    expect(() => logTypesJsonOutputSchema.validate({types: [{name: 'webhook'}]})).toThrow()
    expect(() => logTypesJsonOutputSchema.validate({types: [{...type, name: 'function'}]})).toThrow()
    expect(() => logTypesJsonOutputSchema.validate({types: [{...type, filters: ['client-ip']}]})).toThrow()
    expect(() => logTypesJsonOutputSchema.validate({types: [{...type, limitations: null}]})).toThrow()
    expect(() => logTypesJsonOutputSchema.validate([type])).toThrow()
  })
})
