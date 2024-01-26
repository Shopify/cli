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
