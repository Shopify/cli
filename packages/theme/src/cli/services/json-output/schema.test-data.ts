/**
 * The `--json-schema` Result shape shared by commands defined with defineThemeJsonOutputSchema.
 * A single result is referenced through the ThemeEnvironment definition, which describes the command-specific shape.
 */
export const themeResultJsonSchema = {
  anyOf: [
    {$ref: '#/definitions/ThemeEnvironment/anyOf/0/properties/result'},
    {
      type: 'object',
      properties: {environments: {type: 'array', items: {$ref: '#/definitions/ThemeEnvironment'}}},
      required: ['environments'],
      additionalProperties: false,
    },
  ],
}
