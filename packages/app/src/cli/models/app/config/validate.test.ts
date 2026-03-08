import {validateSpecConfig} from './validate.js'
import {ExtensionSpecification} from '../../extensions/specification.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {describe, expect, test} from 'vitest'

function specWithSchema(schema: zod.ZodTypeAny): ExtensionSpecification {
  return {
    schema,
    identifier: 'test-spec',
    declaredKeys: [],
  } as unknown as ExtensionSpecification
}

describe('validateSpecConfig', () => {
  test('returns empty array for valid config', () => {
    const schema = zod.object({name: zod.string(), embedded: zod.boolean()})
    const spec = specWithSchema(schema)

    const errors = validateSpecConfig({name: 'my-app', embedded: true}, spec)

    expect(errors).toEqual([])
  })

  test('returns Zod errors for invalid config', () => {
    const schema = zod.object({name: zod.string(), embedded: zod.boolean()})
    const spec = specWithSchema(schema)

    const errors = validateSpecConfig({name: 123, embedded: 'not-bool'}, spec)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.path.includes('name'))).toBe(true)
    expect(errors.some((e) => e.path.includes('embedded'))).toBe(true)
  })

  test('returns empty array for zod.any() schema (contract-based specs)', () => {
    const schema = zod.any()
    const spec = specWithSchema(schema)

    const errors = validateSpecConfig({anything: 'goes'}, spec)

    expect(errors).toEqual([])
  })

  test('deduplicates identical errors', () => {
    // Create a schema that would produce the same error path/message
    const schema = zod.object({name: zod.string()})
    const spec = specWithSchema(schema)

    const errors = validateSpecConfig({}, spec)

    // Should have exactly one error for missing 'name', not duplicates
    const nameErrors = errors.filter((e) => e.path.includes('name'))
    expect(nameErrors.length).toBe(1)
  })

  test('validates with contract schema when present', () => {
    const schema = zod.any()
    const spec = {
      ...specWithSchema(schema),
      contractSchema: {
        type: 'object',
        properties: {name: {type: 'string'}},
        required: ['name'],
      },
    } as unknown as ExtensionSpecification

    const errors = validateSpecConfig({}, spec)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.message === 'Required')).toBe(true)
  })
})
