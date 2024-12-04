import {jsonSchemaValidate, normaliseJsonSchema} from './json-schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

describe('jsonSchemaValidate', () => {
  test.each([
    [
      'required field',
      {
        type: 'object',
        properties: {
          foo: {type: 'string'},
        },
        required: ['foo'],
      },
      zod.object({
        foo: zod.string(),
      }),
      {},
    ],
    [
      'nested required field',
      {
        type: 'object',
        properties: {
          foo: {type: 'object', properties: {bar: {type: 'string'}}, required: ['bar']},
        },
        required: ['foo'],
      },
      zod.object({
        foo: zod.object({
          bar: zod.string(),
        }),
      }),
      {foo: {}},
    ],
    [
      'top-level type mismatch',
      {type: 'object', properties: {foo: {type: 'string'}}},
      zod.object({foo: zod.string().optional()}),
      {foo: 123},
    ],
    [
      'string enums',
      {type: 'object', properties: {foo: {enum: ['a', 'b']}}, required: ['foo']},
      zod.object({foo: zod.enum(['a', 'b'])}),
      {foo: 'c'},
    ],
    [
      'max number',
      {type: 'object', properties: {foo: {type: 'number', maximum: 99}}, required: ['foo']},
      zod.object({foo: zod.number().max(99)}),
      {foo: 100},
    ],
  ])('matches the zod behaviour for %s', (name, contract, zodVersion, subject) => {
    const zodParsed = zodVersion.safeParse(subject)
    expect(zodParsed.success).toBe(false)
    if (zodParsed.success) {
      return
    }

    const zodErrors = zodParsed.error.errors.map((error) => ({path: error.path, message: error.message}))

    const schemaParsed = jsonSchemaValidate(subject, contract, `test-${name}`)
    expect(schemaParsed.state).toBe('error')
    expect(schemaParsed.errors, `Converting ${JSON.stringify(schemaParsed.rawErrors)}`).toEqual(zodErrors)
  })

  test('ignores custom x-taplo directive', () => {
    const subject = {
      foo: 'bar',
    }
    const contract = {
      type: 'object',
      properties: {
        foo: {type: 'string'},
      },
      'x-taplo': {foo: 'bar'},
    }
    const schemaParsed = jsonSchemaValidate(subject, contract, 'test2')
    expect(schemaParsed.state).toBe('ok')
  })

  test('deals with a union mismatch with a preferred branch', () => {
    const subject = {
      root: {
        nested: {
          type: 'branch-a',
          supplemental: 123,
        },
      },
    }
    const contract = {
      type: 'object',
      properties: {
        root: {
          type: 'object',
          properties: {
            nested: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    type: {const: 'branch-a'},
                    supplemental: {type: 'string'},
                  },
                  required: ['type', 'supplemental'],
                },
                {
                  type: 'object',
                  properties: {
                    type: {const: 'branch-b'},
                    other: {type: 'string'},
                  },
                  required: ['type', 'other'],
                },
              ],
            },
          },
          required: ['nested'],
        },
      },
    }
    const schemaParsed = jsonSchemaValidate(subject, contract, 'test3')
    expect(schemaParsed.state).toBe('error')
    expect(schemaParsed.errors).toEqual([
      {
        path: ['root', 'nested'],
        message: 'Invalid input',
      },
      {
        path: ['root', 'nested', 'supplemental'],
        message: 'Expected string, received number',
      },
    ])
  })

  test('deals with a union mismatch where preference is unclear', () => {
    const subject = {
      root: {
        nested: {
          type: 'branch-a',
          other: 'this is correct... for branch-b',
        },
      },
    }
    const contract = {
      type: 'object',
      properties: {
        root: {
          type: 'object',
          properties: {
            nested: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    type: {const: 'branch-a'},
                    supplemental: {type: 'string'},
                  },
                  required: ['type', 'supplemental'],
                },
                {
                  type: 'object',
                  properties: {
                    type: {const: 'branch-b'},
                    other: {type: 'string'},
                  },
                  required: ['type', 'other'],
                },
              ],
            },
          },
          required: ['nested'],
        },
      },
    }
    const schemaParsed = jsonSchemaValidate(subject, contract, 'test4')
    expect(schemaParsed.state).toBe('error')
    expect(schemaParsed.errors).toEqual([
      {
        path: ['root', 'nested'],
        message: 'Invalid input',
      },
    ])
  })
})

describe('normaliseJsonSchema', () => {
  test('dereferences schemas with internal $ref pointers', async () => {
    const schema = {
      $id: 'https://example.com/schema.json',
      definitions: {
        foo: {type: 'object', properties: {bar: {type: 'string'}}},
      },
      type: 'object',
      properties: {
        foo: {$ref: '#/definitions/foo'},
      },
      required: ['foo'],
    }

    const dereferenced = await normaliseJsonSchema(JSON.stringify(schema))
    expect(dereferenced).toEqual({
      $id: 'https://example.com/schema.json',
      definitions: {
        foo: {type: 'object', properties: {bar: {type: 'string'}}},
      },
      type: 'object',
      properties: {
        foo: schema.definitions.foo,
      },
      required: ['foo'],
    })
  })

  test("doesn't de-reference external $ref pointers", async () => {
    const schema = {
      $id: 'https://example.com/schema.json',
      type: 'object',
      properties: {
        foo: {$ref: 'https://example.com/external.json#/definitions/foo'},
      },
      required: ['foo'],
    }

    const dereferenced = await normaliseJsonSchema(JSON.stringify(schema))
    expect(dereferenced).toEqual(schema)
  })
})
