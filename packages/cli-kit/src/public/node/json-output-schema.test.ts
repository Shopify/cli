import {defineJsonOutputSchema, type InferJsonOutputSchema} from './json-output-schema.js'
import {zod} from './schema.js'
import {describe, expect, expectTypeOf, test} from 'vitest'

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
  })

  test('renders named collections, optional fields, and records', () => {
    const ItemSchema = zod.object({id: zod.string(), labels: zod.record(zod.string()).optional()})
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.array(ItemSchema),
      definitions: {Item: ItemSchema},
    })

    expect(outputSchema.typescript).toBe(`type Result = Item[]

interface Item {
  id: string
  labels?: Record<string, string>
}`)
  })

  test('documents and preserves passthrough fields', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({status: zod.string()}).passthrough(),
    })

    expect(outputSchema.typescript).toBe(`interface Result {
  status: string
  [key: string]: unknown
}`)
    expect(JSON.parse(outputSchema.encode({status: 'ready', extension: {id: 1}}))).toEqual({
      status: 'ready',
      extension: {id: 1},
    })
  })

  test('requires nested object schemas to have names', () => {
    expect(() =>
      defineJsonOutputSchema({
        name: 'Result',
        schema: zod.object({item: zod.object({id: zod.string()})}),
      }),
    ).toThrow('Nested JSON output object schemas must be included in definitions.')
  })

  test('quotes property names that are not TypeScript identifiers', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({'api-version': zod.string()}),
    })

    expect(outputSchema.typescript).toContain('"api-version": string')
  })
})
