import {deepStrict, errorsToString} from './schema.js'
import {describe, expect, test} from 'vitest'
import {z} from 'zod'

describe('deepStrict', () => {
  test('validates as wrong content an optional sub element as strict', async () => {
    // Given
    const schema = z.object({
      access: z
        .object({
          direct_api_offline_access: z.boolean().optional(),
        })
        .optional(),
    })
    const content = {access: {direct_api_offline_access: true, extraField: 'test'}}

    // When
    const result = deepStrict(schema).safeParse(content)

    // Then
    expect(result.success).toBeFalsy()
  })
  test('validates as good content an optional sub element as strict', async () => {
    // Given
    const schema = z.object({
      access: z
        .object({
          direct_api_offline_access: z.boolean().optional(),
        })
        .optional(),
    })
    const content = {access: {direct_api_offline_access: true}}

    // When
    const result = deepStrict(schema).safeParse(content)

    // Then
    expect(result.success).toBeTruthy()
  })

  test('validates non-optional object schemas as strict', async () => {
    // Given
    const schema = z.object({
      name: z.string(),
    })
    const validContent = {name: 'app'}
    const invalidContent = {name: 'app', extra: 'field'}

    // When
    const strictSchema = deepStrict(schema)

    // Then
    expect(strictSchema.safeParse(validContent).success).toBe(true)
    expect(strictSchema.safeParse(invalidContent).success).toBe(false)
  })

  test('validates deeply nested object structures as strict', async () => {
    // Given
    const schema = z.object({
      level1: z.object({
        level2: z.object({
          key: z.string(),
        }),
      }),
    })
    const invalidContent = {
      level1: {
        level2: {
          key: 'value',
          unwanted: true,
        },
      },
    }

    // When
    const strictSchema = deepStrict(schema)

    // Then
    expect(strictSchema.safeParse(invalidContent).success).toBe(false)
  })

  test('returns non-object schemas unchanged', async () => {
    // Given
    const stringSchema = z.string()

    // When
    const resultSchema = deepStrict(stringSchema)

    // Then
    expect(resultSchema.safeParse('hello').success).toBe(true)
    expect(resultSchema.safeParse(123).success).toBe(false)
  })
})

describe('errorsToString', () => {
  test('returns the message formatted correctly', async () => {
    // Given
    const zodErrors = [
      {
        path: ['root_property'],
        message: 'root property error',
      },
      {
        path: ['section', 'property'],
        message: 'section property error',
      },
      {
        path: ['section', 'property_unkonwn'],
      },
    ]

    // When
    const result = errorsToString(zodErrors)

    // Then
    expect(result).toEqual(
      'root_property: root property error\nsection.property: section property error\nsection.property_unkonwn: Unknow error',
    )
  })
})
