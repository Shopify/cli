import {defineJsonOutputSchema, type InferJsonOutputSchema} from './json-output-schema.js'
import {zod} from './schema.js'
import {describe, expect, expectTypeOf, test} from 'vitest'
import {Ajv} from 'ajv'

describe('JSON output schemas', () => {
  test('infers, validates, and encodes the result from one schema', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({value: zod.string(), count: zod.number().optional()}).strict(),
    })
    type Result = InferJsonOutputSchema<typeof outputSchema>

    expectTypeOf<Result>().toEqualTypeOf<{value: string; count?: number}>()
    expect(outputSchema.validate({value: 'ready'})).toEqual({value: 'ready'})
    expect(outputSchema.encode({value: 'ready', count: 2})).toBe(`{
  "value": "ready",
  "count": 2
}`)
    expect(() => outputSchema.validate({value: 1})).toThrow()
    expect(outputSchema.jsonSchema).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Result',
      type: 'object',
      properties: {value: {type: 'string'}, count: {type: 'number'}},
      required: ['value'],
      additionalProperties: false,
    })
    const validate = new Ajv().compile(outputSchema.jsonSchema)
    expect(validate(JSON.parse(outputSchema.encode({value: 'ready'})))).toBe(true)
    expect(validate({value: 1})).toBe(false)
    expect(validate({value: 'ready', extra: true})).toBe(false)
  })

  test('references named schemas for collections and records', () => {
    const ItemSchema = zod.object({id: zod.string(), labels: zod.record(zod.string()).optional()})
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.array(ItemSchema),
      definitions: {Item: ItemSchema},
    })

    expect(outputSchema.jsonSchema).toMatchObject({
      type: 'array',
      items: {$ref: '#/definitions/Item'},
      definitions: {Item: {type: 'object', required: ['id']}},
    })
    const validate = new Ajv().compile(outputSchema.jsonSchema)
    expect(validate([{id: 'one'}, {id: 'two', labels: {size: 'large'}}])).toBe(true)
    expect(validate([{id: 'one', labels: {size: 2}}])).toBe(false)
    expect(validate([{}])).toBe(false)
  })

  test('preserves enum values in arrays', () => {
    const outputSchema = defineJsonOutputSchema({name: 'Result', schema: zod.array(zod.enum(['a', 'b']))})
    const validate = new Ajv().compile(outputSchema.jsonSchema)

    expect(validate(['a', 'b'])).toBe(true)
    expect(validate(['c'])).toBe(false)
    expect(JSON.parse(outputSchema.encode(['a', 'b']))).toEqual(['a', 'b'])
  })

  test.each([
    ['optional then nullable', zod.string().optional().nullable()],
    ['nullable then optional', zod.string().nullable().optional()],
  ] as const)('preserves optional and nullable fields with %s wrappers', (_order, valueSchema) => {
    const outputSchema = defineJsonOutputSchema({name: 'Result', schema: zod.object({value: valueSchema})})
    const validate = new Ajv().compile(outputSchema.jsonSchema)

    for (const value of [{}, {value: null}, {value: 'ready'}]) {
      expect(validate(value)).toBe(true)
      expect(outputSchema.validate(value)).toEqual(value)
    }
    expect(validate({value: 1})).toBe(false)
  })

  test('documents and preserves passthrough fields', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({status: zod.string()}).passthrough(),
    })
    const result = {status: 'ready', extension: {id: 1}}

    expect(outputSchema.jsonSchema).toMatchObject({additionalProperties: true})
    expect(new Ajv().compile(outputSchema.jsonSchema)(result)).toBe(true)
    expect(JSON.parse(outputSchema.encode(result))).toEqual(result)
  })

  test('supports unnamed nested objects and non-identifier property names', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({item: zod.object({'api-version': zod.string()})}),
    })
    const validate = new Ajv().compile(outputSchema.jsonSchema)

    expect(validate({item: {'api-version': '2026-07'}})).toBe(true)
    expect(validate({item: {'api-version': 1}})).toBe(false)
  })

  test('preserves validation constraints in JSON Schema', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({name: zod.string().min(2), count: zod.number().int().nonnegative()}),
    })
    const validate = new Ajv().compile(outputSchema.jsonSchema)

    expect(validate({name: 'OK', count: 0})).toBe(true)
    expect(validate({name: 'x', count: 0})).toBe(false)
    expect(validate({name: 'OK', count: -1})).toBe(false)
    expect(validate({name: 'OK', count: 1.5})).toBe(false)
  })
})
