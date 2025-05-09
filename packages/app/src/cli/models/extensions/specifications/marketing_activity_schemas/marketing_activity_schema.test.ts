import {MarketingActivityExtensionSchema} from './marketing_activity_schema.js'
import {describe, expect, test} from 'vitest'

describe('MarketingActivityExtensionSchema', () => {
  const config = {
    name: 'test extension',
    type: 'marketing_activity_extension',
    title: 'test extension 123',
    description: 'test description 123',
    api_path: '/api',
    tactic: 'ad',
    marketing_channel: 'social',
    referring_domain: 'http://foo.bar',
    is_automation: false,
    use_external_editor: false,
    preview_data: {
      types: [
        {
          label: 'mobile',
          value: 'http://foo.bar/preview',
        },
      ],
    },
    fields: [
      {
        id: '123',
        ui_type: 'text-single-line',
        name: 'test_field',
        label: 'test field',
        help_text: 'help text',
        required: false,
        min_length: 1,
        max_length: 50,
        placeholder: 'placeholder',
      },
    ],
  }

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = MarketingActivityExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  describe('fields', () => {
    test('throws an error if a field is not an object', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: ['not an object'],
        }),
      ).toThrow('Field must be an object')
    })

    test('throws an error if no fields are defined', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [],
        }),
      ).toThrow('Array must contain at least 1 element(s)')
    })

    test('throws an error if field does not have ui_type', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [
            {
              ...config.fields[0],
              ui_type: undefined,
            },
          ],
        }),
      ).toThrow('Field must have a ui_type')
    })

    test('throws an error if ui_type is not supported', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [
            {
              ...config.fields[0],
              ui_type: 'not_a_ui_type',
            },
          ],
        }),
      ).toThrow('Unknown ui_type for Field: not_a_ui_type')
    })

    test('throws an error if the schema for the ui_type is invalid', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [
            {
              key: 'test_field',
              name: 'test field',
              description: 'test description',
              min_length: true,
            },
          ],
        }),
      ).toThrow('Field must have a ui_type')
    })
  })
})
