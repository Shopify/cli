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
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "message": "Field must be an object",
            "code": "custom",
            "path": [
              "fields",
              0
            ]
          }
        ]]
      `)
    })

    test('throws an error if no fields are defined', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [],
        }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "origin": "array",
            "code": "too_small",
            "minimum": 1,
            "inclusive": true,
            "path": [
              "fields"
            ],
            "message": "Too small: expected array to have >=1 items"
          }
        ]]
      `)
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
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "message": "Field must have a ui_type",
            "code": "custom",
            "path": [
              "fields",
              0
            ]
          }
        ]]
      `)
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
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "message": "Unknown ui_type for Field: not_a_ui_type",
            "code": "custom",
            "path": [
              "fields",
              0
            ]
          }
        ]]
      `)
    })

    test('throws an error if the schema for the ui_type is invalid', async () => {
      // When/Then
      expect(() =>
        MarketingActivityExtensionSchema.parse({
          ...config,
          fields: [
            {
              ...config.fields[0],
              min_length: false,
            },
          ],
        }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "message": "Error found on Field \\"test_field\\": [\\n  {\\n    \\"expected\\": \\"number\\",\\n    \\"code\\": \\"invalid_type\\",\\n    \\"path\\": [\\n      \\"min_length\\"\\n    ],\\n    \\"message\\": \\"Invalid input: expected number, received boolean\\"\\n  }\\n]",
            "code": "custom",
            "path": [
              "fields",
              0
            ]
          }
        ]]
      `)
    })
  })
})
