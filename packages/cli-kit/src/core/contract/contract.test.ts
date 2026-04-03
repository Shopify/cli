import {Contract} from './contract.js'
import {zod} from '../../public/node/schema.js'
import {describe, expect, test} from 'vitest'
import type {JsonMapType} from '../../public/node/toml/codec.js'

const SIMPLE_JSON_SCHEMA = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {type: 'string'},
    count: {type: 'number'},
  },
  required: ['name'],
})

const NESTED_JSON_SCHEMA = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    app_url: {type: 'string'},
    embedded: {type: 'boolean'},
    preferences_url: {type: 'string'},
  },
  required: ['app_url', 'embedded'],
})

describe('Contract', () => {
  describe('fromJsonSchema', () => {
    test('validates valid input with no errors', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const errors = contract.validate({name: 'test', count: 42})
      expect(errors).toHaveLength(0)
    })

    test('returns errors for invalid input', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const errors = contract.validate({count: 42})
      expect(errors.length).toBeGreaterThan(0)
    })

    test('rejects additional properties', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const errors = contract.validate({name: 'test', unexpected: true})
      expect(errors.length).toBeGreaterThan(0)
    })

    test('never mutates the input', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const input = {name: 'test', count: 42}
      const inputCopy = structuredClone(input)
      contract.validate(input)
      expect(input).toStrictEqual(inputCopy)
    })

    test('exposes properties from the schema', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      expect(Object.keys(contract.properties)).toStrictEqual(['name', 'count'])
    })

    test('exposes required keys', async () => {
      const contract = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      expect(contract.required).toStrictEqual(['name'])
    })
  })

  describe('fromLocalSchema', () => {
    test('validates valid input', () => {
      const schema = zod.object({
        name: zod.string(),
        value: zod.number().optional(),
      })
      const contract = Contract.fromLocalSchema(schema)
      const errors = contract.validate({name: 'hello'})
      expect(errors).toHaveLength(0)
    })

    test('returns errors for invalid input', () => {
      const schema = zod.object({name: zod.string()})
      const contract = Contract.fromLocalSchema(schema)
      const errors = contract.validate({name: 123})
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('withAdapter', () => {
    test('transforms before validating', () => {
      const serverSchema = zod.object({
        app_url: zod.string(),
        embedded: zod.boolean(),
      })
      const transform = (config: JsonMapType): JsonMapType => ({
        app_url: config.application_url as string,
        embedded: config.embedded as boolean,
      })
      const contract = Contract.withAdapter({schema: serverSchema, transform})

      const errors = contract.validate({application_url: 'https://example.com', embedded: true})
      expect(errors).toHaveLength(0)
    })

    test('returns errors when transformed data is invalid', () => {
      const serverSchema = zod.object({
        app_url: zod.string().url(),
      })
      const transform = (config: JsonMapType): JsonMapType => ({
        app_url: config.application_url as string,
      })
      const contract = Contract.withAdapter({schema: serverSchema, transform})

      const errors = contract.validate({application_url: 'not-a-url'})
      expect(errors.length).toBeGreaterThan(0)
    })

    test('never mutates the input', () => {
      const schema = zod.object({val: zod.string()})
      const transform = (config: JsonMapType): JsonMapType => ({val: config.source as string})
      const contract = Contract.withAdapter({schema, transform})

      const input = {source: 'hello'}
      const inputCopy = structuredClone(input)
      contract.validate(input)
      expect(input).toStrictEqual(inputCopy)
    })
  })

  describe('compose', () => {
    test('collects errors from all contracts', async () => {
      const contract1 = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const contract2 = Contract.fromLocalSchema(zod.object({name: zod.string().min(10)}))

      const composed = Contract.compose(contract1, contract2)
      const errors = composed.validate({name: 'hi'})
      expect(errors.length).toBeGreaterThan(0)
    })

    test('returns no errors when all contracts pass', async () => {
      const contract1 = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const contract2 = Contract.fromLocalSchema(zod.object({name: zod.string()}))

      const composed = Contract.compose(contract1, contract2)
      const errors = composed.validate({name: 'hello'})
      expect(errors).toHaveLength(0)
    })

    test('merges properties from all contracts', async () => {
      const contract1 = await Contract.fromJsonSchema(SIMPLE_JSON_SCHEMA)
      const contract2 = await Contract.fromJsonSchema(NESTED_JSON_SCHEMA)

      const composed = Contract.compose(contract1, contract2)
      const propKeys = Object.keys(composed.properties)
      expect(propKeys).toContain('name')
      expect(propKeys).toContain('app_url')
    })
  })
})
