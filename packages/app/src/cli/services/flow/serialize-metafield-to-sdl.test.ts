import {getFieldType, generateGraphQLField, loadSchemaPatchFromReturns} from './serialize-metafield-to-sdl.js'
import {FieldSchema, FlowReturnSchema} from '../../models/extensions/schemas.js'
import {describe, expect, test} from 'vitest'

describe('getFieldType', () => {
  test('should handle single_line_text_field type correctly', () => {
    // Given
    const field = {
      type: 'single_line_text_field',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: 'String',
    })
  })

  test('should handle a required field correctly', () => {
    // Given
    const field = {
      type: 'single_line_text_field',
      required: true,
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: 'String!',
    })
  })

  test('should handle boolean type correctly', () => {
    // Given
    const field = {
      type: 'boolean',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: 'Boolean',
    })
  })

  test('should handle number_integer type correctly', () => {
    // Given
    const field = {
      type: 'number_integer',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: 'Int',
    })
  })

  test('should handle metaobject_reference type correctly', () => {
    // Given
    const field = {
      type: 'metaobject_reference<limits>',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: 'Limits',
    })
  })

  test('should handle list.metaobject_reference type correctly', () => {
    // Given
    const field = {
      type: 'list.metaobject_reference<attachments>',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: '[Attachments]',
    })
  })

  test('should handle single_line_text_field with choices correctly', () => {
    // Given
    const field = {
      key: 'status',
      type: 'single_line_text_field',
      validations: [
        {
          choices: ['ok', 'warn', 'disable'],
        },
      ],
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: `enum ObjectKeyStatusEnum {
  ok
  warn
  disable
}`,
      fieldType: 'ObjectKeyStatusEnum',
    })
  })

  test('should handle a field that is a list of single_line_text_field', () => {
    // Given
    const field = {
      type: 'list.single_line_text_field',
    }

    // When
    const result = getFieldType(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual({
      enumType: undefined,
      fieldType: '[String]',
    })
  })
})

test('should handle a field that is a list of single_line_text_field with choices', () => {
  // Given
  const field = {
    key: 'statuses',
    type: 'list.single_line_text_field',
    validations: [
      {
        choices: ['ok', 'warn', 'disable'],
      },
    ],
  }

  // When
  const result = getFieldType(FieldSchema.parse(field), 'object_key')

  // Then
  expect(result).toEqual({
    enumType: `enum ObjectKeyStatusesEnum {
  ok
  warn
  disable
}`,
    fieldType: '[ObjectKeyStatusesEnum]',
  })
})

describe('generateGraphQLField', () => {
  test('should generate GraphQL field with description', () => {
    // Given
    const field = {
      key: 'status',
      type: 'single_line_text_field',
      description: 'Status of the object',
    }

    // When
    const result = generateGraphQLField(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual('  # Status of the object\n  status: String\n')
  })

  test('should generate GraphQL field without description', () => {
    // Given
    const field = {
      key: 'status',
      type: 'single_line_text_field',
    }

    // When
    const result = generateGraphQLField(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual('  status: String\n')
  })

  test('should generate GraphQL field with choices', () => {
    // Given
    const field = {
      key: 'status',
      type: 'single_line_text_field',
      validations: [
        {
          choices: ['ok', 'warn', 'disable'],
        },
      ],
    }

    // When
    const result = generateGraphQLField(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual('  status: ObjectKeyStatusEnum\n')
  })

  test('should generate GraphQL field with required flag', () => {
    // Given
    const field = {
      key: 'status',
      type: 'single_line_text_field',
      required: true,
    }

    // When
    const result = generateGraphQLField(FieldSchema.parse(field), 'object_key')

    // Then
    expect(result).toEqual('  status: String!\n')
  })
})

describe('loadSchemaPatchFromReturns', () => {
  test('should load schema patch from returns correctly', () => {
    // Given
    const returns = {
      objects: [
        {
          description: 'object description',
          key: 'object_key',
          fields: [
            {
              description: 'field description',
              key: 'field_key',
              type: 'single_line_text_field',
              required: true,
              validations: [
                {
                  choices: ['choice1', 'choice2'],
                },
              ],
            },
          ],
        },
      ],
    }

    // When
    const result = loadSchemaPatchFromReturns(FlowReturnSchema.parse(returns))

    // Then
    const expected = `# object description\ntype ObjectKey {\n  # field description\n  field_key: ObjectKeyFieldKeyEnum!\n}\nenum ObjectKeyFieldKeyEnum {\n  choice1\n  choice2\n}\n`
    expect(result).toEqual(expected)
  })

  test('should handle an object that has a field that is another object', () => {
    // Given
    const returns = {
      objects: [
        {
          key: 'card',
          fields: [
            {
              key: 'limits',
              type: 'metaobject_reference<limits>',
            },
          ],
        },
        {
          key: 'limits',
          fields: [
            {
              key: 'attachments',
              type: 'number_integer',
            },
          ],
        },
      ],
    }

    // When
    const result = loadSchemaPatchFromReturns(FlowReturnSchema.parse(returns))

    // Then
    const expected = `type Card {\n  limits: Limits\n}\ntype Limits {\n  attachments: Int\n}\n`
    expect(result).toEqual(expected)
  })

  test('should handle a field that is a list of another object', () => {
    // Given
    const returns = {
      objects: [
        {
          key: 'card',
          fields: [
            {
              key: 'attachments',
              type: 'list.metaobject_reference<attachments>',
            },
          ],
        },
        {
          key: 'attachments',
          fields: [
            {
              key: 'status',
              type: 'single_line_text_field',
            },
          ],
        },
      ],
    }

    // When
    const result = loadSchemaPatchFromReturns(FlowReturnSchema.parse(returns))

    // Then
    const expected = `type Card {\n  attachments: [Attachments]\n}\ntype Attachments {\n  status: String\n}\n`
    expect(result).toEqual(expected)
  })

  test('should handle a field that is a list of single_line_text_field with choices', () => {
    // Given
    const returns = {
      objects: [
        {
          key: 'card',
          fields: [
            {
              key: 'statuses',
              type: 'list.single_line_text_field',
              validations: [
                {
                  choices: ['ok', 'warn', 'disable'],
                },
              ],
            },
          ],
        },
      ],
    }

    // When
    const result = loadSchemaPatchFromReturns(FlowReturnSchema.parse(returns))

    // Then
    const expected = `type Card {\n  statuses: [CardStatusesEnum]\n}\nenum CardStatusesEnum {\n  ok\n  warn\n  disable\n}\n`
    expect(result).toEqual(expected)
  })

  test('should handle a field that is a list of single_line_text_field', () => {
    // Given
    const returns = {
      objects: [
        {
          key: 'card',
          fields: [
            {
              key: 'names',
              type: 'list.single_line_text_field',
            },
          ],
        },
      ],
    }

    // When
    const result = loadSchemaPatchFromReturns(FlowReturnSchema.parse(returns))

    // Then
    const expected = `type Card {\n  names: [String]\n}\n`
    expect(result).toEqual(expected)
  })
})
