import {jsonSchemaValidate, normaliseJsonSchema} from './json-schema.js'
import {decodeToml} from './toml.js'
import {zod} from './schema.js'
import {describe, expect, test} from 'vitest'

const COMPLEX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product: {
      type: 'object',
      required: ['metafields'],
      additionalProperties: false,
      properties: {
        metafields: {
          $ref: '#/definitions/OwnerTypeMetafieldNamespaces',
        },
      },
      title: 'Custom Data \u003e Metafields',
      description:
        'Namespaces for metafields under this owner type. For example, `[product.metafields.app.example]` creates a metafield under the `$app` namespace, with the key `example`.\n\nRequires the following access scope: write_products',
    },
  },
  definitions: {
    MetaFieldDefinitionTypes: {
      type: 'string',
      oneOf: [
        {
          type: 'string',
          pattern:
            '(?\u003ctype\u003e(list\\.)?(metaobject_reference|mixed_reference))\u003c(?\u003creferences\u003e(\\$app:[a-zA-Z0-9_-]+(,\\s*)?)+)\u003e',
        },
        {
          type: 'string',
          enum: [
            'boolean',
            'color',
            'date_time',
            'date',
            'dimension',
            'json',
            'language',
            'list.color',
            'list.date_time',
            'list.date',
            'list.dimension',
            'list.number_decimal',
            'list.number_integer',
            'list.rating',
            'list.single_line_text_field',
            'list.url',
            'list.volume',
            'list.weight',
            'money',
            'multi_line_text_field',
            'number_decimal',
            'number_integer',
            'rating',
            'rich_text_field',
            'single_line_text_field',
            'url',
            'link',
            'list.link',
            'volume',
            'weight',
            'company_reference',
            'list.company_reference',
            'customer_reference',
            'list.customer_reference',
            'product_reference',
            'list.product_reference',
            'collection_reference',
            'list.collection_reference',
            'variant_reference',
            'list.variant_reference',
            'file_reference',
            'list.file_reference',
            'product_taxonomy_value_reference',
            'list.product_taxonomy_value_reference',
            'metaobject_reference',
            'list.metaobject_reference',
            'mixed_reference',
            'list.mixed_reference',
            'page_reference',
            'list.page_reference',
            'order_reference',
          ],
        },
      ],
      title: 'Custom Data \u003e Types',
      description:
        'Set the [data type](https://shopify.dev/docs/apps/build/custom-data/metafields/list-of-data-types) of the metafield.\n\nEach [metafield](https://shopify.dev/docs/apps/build/custom-data) and [metafield definition](https://shopify.dev/docs/apps/build/custom-data/metafields/definitions) has a type, which defines the type of information that it can store. The metafield types have built-in validation and [Liquid](https://shopify.dev/docs/api/liquid/objects/metafield) support.',
    },
    ValidationRule: {
      type: 'object',
      additionalProperties: {
        type: ['number', 'string', 'object', 'array'],
      },
      title: 'Custom Data \u003e Validation Rules',
      description:
        'Validation options enable you to apply additional constraints to the data that a metafield can store, such as a minimum or maximum value, or a regular expression. This guide shows you how to manage validation options using the GraphQL Admin API.',
    },
    OwnerTypeMetafieldNamespaces: {
      type: 'object',
      additionalProperties: {
        $ref: '#/definitions/MetafieldsCollection',
      },
      properties: {
        app: {
          $ref: '#/definitions/MetafieldsCollection',
        },
      },
      title: 'Custom Data \u003e Metafields',
      description:
        'Namespaces for metafields under this owner type. For example, `[products.metafields.app]` creates metafields under the `app` namespace for products.',
    },
    MetafieldsCollection: {
      type: 'object',
      additionalProperties: {
        $ref: '#/definitions/Metafield',
      },
      title: 'Custom Data \u003e Metafields',
      description:
        'A namespace for metafields. `.app` places metafields under the `$app` namespace; `.other` places metafields under the `$app:other` namespace.',
    },
    Metafield: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      title: 'Custom Data \u003e Metafields',
      description:
        "Metafields are a flexible way for your app to add and store additional information about a Shopify resource, such as a product, a collection, [and many other owner types](https://shopify.dev/docs/api/admin-graphql/latest/enums/MetafieldOwnerType). The additional information stored in metafields can be almost anything related to a resource. Some examples are specifications, size charts, downloadable documents, release dates, images, or part numbers.\n\nMerchants and other apps can retrieve and edit the data that's stored in metafields from the Shopify admin. You can also access metafields in themes using Liquid and through the Storefront API.",
      properties: {
        type: {
          $ref: '#/definitions/MetaFieldDefinitionTypes',
        },
        name: {
          type: 'string',
          title: 'Custom Data \u003e Metafields',
          description: 'The human-readable name of the metafield definition.',
        },
        description: {
          type: 'string',
          title: 'Custom Data \u003e Metafields',
          description: 'The description of the metafield definition.',
        },
        validations: {
          $ref: '#/definitions/ValidationRule',
        },
        capabilities: {
          $ref: '#/definitions/MetafieldCapabilities',
        },
        access: {
          $ref: '#/definitions/MetafieldAccessControls',
        },
      },
    },
    MetafieldCapabilities: {
      type: 'object',
      additionalProperties: false,
      title: 'Custom Data \u003e Metafields',
      description: 'The capabilities of the metafield definition.',
      properties: {
        admin_filterable: {
          type: 'boolean',
          title: 'Custom Data \u003e Metafields \u003e Admin Filterable',
          description:
            'The admin filterable capability allows you to use a metafield definition and its values to filter resource lists in the Shopify admin. This capability makes it easier for merchants to find and manage resources such as products based on their specific metafield values.',
        },
      },
    },
    MetafieldAccessControls: {
      type: 'object',
      additionalProperties: false,
      title: 'Custom Data \u003e Metafields',
      description: 'The access settings that apply to each of the metafields that belong to the metafield definition.',
      properties: {
        admin: {
          title: 'Custom Data \u003e Access Control',
          description: 'Access configuration for Admin API surface areas, including the GraphQL Admin API.',
          type: 'string',
          enum: ['merchant_read', 'merchant_read_write'],
        },
        storefront: {
          title: 'Custom Data \u003e Access Control',
          description:
            'Access configuration for Storefront API surface areas, including the GraphQL Storefront API and Liquid.',
          type: 'string',
          enum: ['none', 'public_read'],
        },
        customer_account: {
          title: 'Custom Data \u003e Access Control',
          description: 'The Customer Account API access setting to use for the metafields under this definition.',
          type: 'string',
          enum: ['none', 'read', 'read_write'],
        },
      },
    },
  },
}

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
  ])('matches the zod behaviour for %s', (_name, contract, zodVersion, subject) => {
    const zodParsed = zodVersion.safeParse(subject)
    expect(zodParsed.success).toBe(false)
    if (zodParsed.success) {
      return
    }

    const zodErrors = zodParsed.error.issues.map((error) => ({path: error.path, message: error.message}))

    const schemaParsed = jsonSchemaValidate(subject, contract, 'strip')
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
    const schemaParsed = jsonSchemaValidate(subject, contract, 'strip')
    expect(schemaParsed.state).toBe('ok')
  })

  test('removes additional properties', () => {
    const subject = {
      foo: 'bar',
      baz: 'qux',
    }
    const contract = {additionalProperties: false, type: 'object', properties: {foo: {type: 'string'}}}
    const schemaParsed = jsonSchemaValidate(subject, contract, 'strip')
    expect(schemaParsed.state).toBe('ok')
    expect(schemaParsed.data).toEqual({foo: 'bar'})
    // confirm we don't mutate input parameters
    expect(schemaParsed.data).not.toEqual(subject)
  })

  test('fails on additional properties', () => {
    const subject = {
      foo: 'bar',
      baz: 'qux',
    }
    const contract = {additionalProperties: false, type: 'object', properties: {foo: {type: 'string'}}}
    const schemaParsed = jsonSchemaValidate(subject, contract, 'fail')
    expect(schemaParsed.state).toBe('error')
    expect(schemaParsed.errors).toEqual([
      {
        path: [],
        message: 'must NOT have additional properties',
      },
    ])
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
    const schemaParsed = jsonSchemaValidate(subject, contract, 'strip')
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
    const schemaParsed = jsonSchemaValidate(subject, contract, 'fail')
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

describe('validate complex schema', () => {
  test('validates with useful error messages', async () => {
    const subject = decodeToml(`
[product.metafields.app.first_published]
type = "year"
nime = "First published"
bar = "boo"
validations.min = false`)

    const result = jsonSchemaValidate(subject, COMPLEX_SCHEMA, 'fail')
    expect(result.state).toBe('error')
    expect(result.errors).toMatchInlineSnapshot(`
      [
        {
          "message": "No additional properties allowed. You can set access, capabilities, description, name.",
          "path": [
            "product",
            "metafields",
            "app",
            "first_published",
            "nime",
          ],
        },
        {
          "message": "No additional properties allowed. You can set access, capabilities, description, name.",
          "path": [
            "product",
            "metafields",
            "app",
            "first_published",
            "bar",
          ],
        },
        {
          "message": "Expected number, string, object, array, received boolean",
          "path": [
            "product",
            "metafields",
            "app",
            "first_published",
            "validations",
            "min",
          ],
        },
        {
          "message": "Invalid input",
          "path": [
            "product",
            "metafields",
            "app",
            "first_published",
            "type",
          ],
        },
      ]
    `)
  })

  test('correctly strips additional properties', () => {
    const subject = {
      product: {metafields: {app: {example: {type: 'single_line_text_field'}}}},
    } as any
    let result = jsonSchemaValidate(subject, COMPLEX_SCHEMA, 'strip')
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({
      product: {metafields: {app: {example: {type: 'single_line_text_field'}}}},
    })

    // extra top-level properties are ignored and don't cause errors
    subject.extra = {property: 'ignore'}
    result = jsonSchemaValidate(subject, COMPLEX_SCHEMA, 'strip')
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({
      product: {metafields: {app: {example: {type: 'single_line_text_field'}}}},
    })

    // an extra property within my sub-schema is an error, if they're not allowed
    subject.product.metafields.app.example.extra = {property: 'causes failure'}
    result = jsonSchemaValidate(subject, COMPLEX_SCHEMA, 'strip')
    expect(result.state).toBe('error')
    expect(result.errors).toMatchInlineSnapshot(`
      [
        {
          "message": "No additional properties allowed. You can set access, capabilities, description, name, validations.",
          "path": [
            "product",
            "metafields",
            "app",
            "example",
            "extra",
          ],
        },
      ]
    `)

    // but, if the sub-schema allows extra properties, then they're allowed
    const complexSchemaWithAllowedAdditionalProperties = JSON.parse(JSON.stringify(COMPLEX_SCHEMA))
    complexSchemaWithAllowedAdditionalProperties.definitions.Metafield.additionalProperties = true

    result = jsonSchemaValidate(subject, complexSchemaWithAllowedAdditionalProperties, 'strip')
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({
      product: {metafields: {app: {example: {type: 'single_line_text_field', extra: {property: 'causes failure'}}}}},
    })
  })
})
