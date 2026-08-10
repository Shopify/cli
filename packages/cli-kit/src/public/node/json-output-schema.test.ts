import {defineJsonOutputSchema, renderJsonOutputSchema} from './json-output-schema.js'
import {zod} from './schema.js'
import {describe, expect, test} from 'vitest'

describe('JSON output schemas', () => {
  test('renders named object schemas as TypeScript interfaces', () => {
    const ItemSchema = zod.object({
      id: zod.string().optional(),
      state: zod.enum(['ready', 'pending']),
    })
    const ResultSchema = zod.object({
      items: zod.array(ItemSchema),
      cursor: zod.string().nullable().optional(),
    })
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: ResultSchema,
      definitions: {Item: ItemSchema},
    })

    expect(renderJsonOutputSchema(outputSchema)).toBe(`interface Result {
  items: Item[]
  cursor?: string | null
}

interface Item {
  id?: string
  state: "ready" | "pending"
}`)
  })

  test('requires nested object schemas to be named', () => {
    const outputSchema = defineJsonOutputSchema({
      name: 'Result',
      schema: zod.object({item: zod.object({id: zod.string()})}),
    })

    expect(() => renderJsonOutputSchema(outputSchema)).toThrow(
      'Nested JSON output object schemas must be included in definitions.',
    )
  })
})
