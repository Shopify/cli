import {
  ConvertedMetaobject,
  convertMetaobject,
  processDeclarativeDefinitionNodes,
  MetafieldNodesInput,
} from './declarative-definitions.js'
import {MetaobjectForImportFragment} from '../../../api/graphql/admin/generated/metaobject_definitions.js'
import {MetafieldForImportFragment} from '../../../api/graphql/admin/generated/metafield_definitions.js'
import {describe, expect, test} from 'vitest'

const defaultMetaobjectFragment = {
  name: 'test',
  access: {
    admin: 'MERCHANT_READ',
    storefront: 'NONE',
  },
  capabilities: {
    publishable: {
      enabled: false,
    },
    translatable: {
      enabled: false,
    },
  },
  fieldDefinitions: [
    {
      key: 'foo',
      name: 'foo',
      required: false,
      type: {
        category: 'string',
        name: 'single_line_text_field',
      },
      validations: [],
    },
  ],
} as const satisfies Partial<MetaobjectForImportFragment>

const defaultMetafieldFragment = {
  name: 'Color',
  key: 'color',
  description: 'The color of the product',
  access: {
    admin: 'MERCHANT_READ',
    storefront: 'NONE',
    customerAccount: 'NONE',
  },
  capabilities: {
    adminFilterable: {
      enabled: false,
    },
  },
  type: {
    category: 'string',
    name: 'single_line_text_field',
  },
  validations: [],
} as const satisfies Partial<MetafieldForImportFragment>

describe('convertMetaobject', () => {
  test.for<[MetaobjectForImportFragment, ConvertedMetaobject]>([
    [
      {
        type: 'custom',
        ...defaultMetaobjectFragment,
      },
      {
        status: 'not_app_reserved',
      },
    ],
    [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
      },
      {
        status: 'ok',
        typeName: 'test',
        patches: [[[['metaobjects', 'app', 'test', 'fields', 'foo'], 'single_line_text_field']], []],
        metaobject: {
          fields: {
            foo: {
              type: 'single_line_text_field',
            },
          },
        },
      },
    ],
    [
      {
        access: {
          admin: 'MERCHANT_READ_WRITE',
          storefront: 'PUBLIC_READ',
        },
        capabilities: {
          publishable: {
            enabled: true,
          },
          translatable: {
            enabled: true,
          },
          renderable: {
            enabled: true,
            data: {
              metaTitleKey: 'title',
              metaDescriptionKey: 'description',
            },
          },
        },
        name: 'A test',
        type: 'app--345678--test',
        description: 'A test metaobject',
        displayNameKey: 'title',
        fieldDefinitions: [
          {
            key: 'title',
            name: 'Title',
            required: true,
            type: {
              category: 'string',
              name: 'single_line_text_field',
            },
            description: 'The title of the test metaobject',
            validations: [
              {
                name: 'min',
                value: '1',
              },
              {
                name: 'list.min',
                value: '999',
              },
              {
                name: 'choices',
                value: '["a", "b", "c"]',
              },
              {
                name: 'schema',
                value: '{"type": "string", "minLength": 1, "maxLength": 100}',
              },
            ],
          },
        ],
      },
      {
        status: 'ok',
        typeName: 'test',
        metaobject: {
          name: 'A test',
          description: 'A test metaobject',
          display_name_field: 'title',
          fields: {
            title: {
              type: 'single_line_text_field',
              description: 'The title of the test metaobject',
              required: true,
              name: 'Title',
              validations: {
                min: 1,
                'list.min': 999,
                choices: ['a', 'b', 'c'],
                schema: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                },
              },
            },
          },
          access: {
            admin: 'merchant_read_write',
            storefront: 'public_read',
          },
          capabilities: {
            publishable: true,
            translatable: true,
            renderable: true,
            renderable_meta_title_field: 'title',
            renderable_meta_description_field: 'description',
          },
        },
        patches: [
          [
            [['metaobjects', 'app', 'test', 'name'], 'A test'],
            [['metaobjects', 'app', 'test', 'description'], 'A test metaobject'],
            [['metaobjects', 'app', 'test', 'display_name_field'], 'title'],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'type'], 'single_line_text_field'],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'description'], 'The title of the test metaobject'],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'name'], 'Title'],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'required'], true],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'validations', 'min'], 1],
            [['metaobjects', 'app', 'test', 'fields', 'title', 'validations', 'list.min'], 999],
            [
              ['metaobjects', 'app', 'test', 'fields', 'title', 'validations', 'choices'],
              ['a', 'b', 'c'],
            ],
            [
              ['metaobjects', 'app', 'test', 'fields', 'title', 'validations', 'schema'],
              JSON.stringify({
                type: 'string',
                minLength: 1,
                maxLength: 100,
              }),
            ],
          ],
          [
            [['metaobjects', 'app', 'test', 'access', 'admin'], 'merchant_read_write'],
            [['metaobjects', 'app', 'test', 'access', 'storefront'], 'public_read'],
            [['metaobjects', 'app', 'test', 'capabilities', 'translatable'], true],
            [['metaobjects', 'app', 'test', 'capabilities', 'publishable'], true],
            [['metaobjects', 'app', 'test', 'capabilities', 'renderable'], true],
            [['metaobjects', 'app', 'test', 'capabilities', 'renderable_meta_title_field'], 'title'],
            [['metaobjects', 'app', 'test', 'capabilities', 'renderable_meta_description_field'], 'description'],
          ],
        ],
      },
    ],
  ])(`should convert metaobject %s`, ([input, expected]) => {
    const result = convertMetaobject(input)
    expect(result).toEqual(expected)
  })
})

describe('processDeclarativeDefinitionNodes', () => {
  test('returns empty TOML when given empty inputs', () => {
    const result = processDeclarativeDefinitionNodes([], [])

    expect(result.metafieldCount).toBe(0)
    expect(result.metaobjectCount).toBe(0)
    expect(result.tomlContent).toMatchInlineSnapshot(`""`)
  })

  test('processes single metafield correctly', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(1)
    expect(result.metaobjectCount).toBe(0)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('processes metafields with custom namespace', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456--custom',
            ...defaultMetafieldFragment,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app:custom key: color owner_type: PRODUCT
      [product.metafields.custom.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('skips non-app-reserved metafields', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'custom',
            ...defaultMetafieldFragment,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(0)
    expect(result.tomlContent).toMatchInlineSnapshot(`""`)
  })

  test('processes metafields with validations', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            validations: [
              {name: 'min', value: '5'},
              {name: 'max', value: '50'},
              {name: 'choices', value: '["red", "blue", "green"]'},
            ],
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      [product.metafields.app.color.validations]
      min = 5
      max = 50
      choices = [\\"red\\", \\"blue\\", \\"green\\"]
      "
    `)
  })

  test('processes metafields with access controls', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            access: {
              admin: 'MERCHANT_READ_WRITE',
              storefront: 'PUBLIC_READ',
              customerAccount: 'READ',
            },
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      access.admin = \\"merchant_read_write\\"
      access.storefront = \\"public_read\\"
      access.customer_account = \\"read\\"
      "
    `)
  })

  test('processes metafields with capabilities', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            capabilities: {
              adminFilterable: {
                enabled: true,
              },
            },
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      capabilities.admin_filterable = true
      "
    `)
  })

  test('processes multiple metafields across different owner types', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            key: 'color',
            name: 'Color',
          } as MetafieldForImportFragment,
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            key: 'size',
            name: 'Size',
          } as MetafieldForImportFragment,
        ],
      },
      {
        ownerType: 'customer',
        graphQLOwner: 'CUSTOMER',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            key: 'vip_status',
            name: 'VIP Status',
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(3)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      # namespace: $app key: size owner_type: PRODUCT
      [product.metafields.app.size]
      name = \\"Size\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      # namespace: $app key: vip_status owner_type: CUSTOMER
      [customer.metafields.app.vip_status]
      name = \\"VIP Status\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('processes single metaobject correctly', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.metafieldCount).toBe(0)
    expect(result.metaobjectCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields]
      foo = \\"single_line_text_field\\"
      "
    `)
  })

  test('processes metaobjects with full configuration', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        access: {
          admin: 'MERCHANT_READ_WRITE',
          storefront: 'PUBLIC_READ',
        },
        capabilities: {
          publishable: {
            enabled: true,
          },
          translatable: {
            enabled: true,
          },
          renderable: {
            enabled: true,
            data: {
              metaTitleKey: 'title',
              metaDescriptionKey: 'description',
            },
          },
        },
        name: 'A test',
        type: 'app--345678--test',
        description: 'A test metaobject',
        displayNameKey: 'title',
        fieldDefinitions: [
          {
            key: 'title',
            name: 'Title',
            required: true,
            type: {
              category: 'string',
              name: 'single_line_text_field',
            },
            description: 'The title of the test metaobject',
            validations: [
              {name: 'min', value: '1'},
              {name: 'max', value: '100'},
            ],
          },
        ],
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.metaobjectCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test]
      name = \\"A test\\"
      description = \\"A test metaobject\\"
      display_name_field = \\"title\\"
      access.admin = \\"merchant_read_write\\"
      access.storefront = \\"public_read\\"
      capabilities.translatable = true
      capabilities.publishable = true
      capabilities.renderable = true
      capabilities.renderable_meta_title_field = \\"title\\"
      capabilities.renderable_meta_description_field = \\"description\\"

      [metaobjects.app.test.fields.title]
      type = \\"single_line_text_field\\"
      description = \\"The title of the test metaobject\\"
      name = \\"Title\\"
      required = true

      [metaobjects.app.test.fields.title.validations]
      min = 1
      max = 100
      "
    `)
  })

  test('skips non-app-reserved metaobjects', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'custom',
        ...defaultMetaobjectFragment,
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.metaobjectCount).toBe(0)
    expect(result.tomlContent).toMatchInlineSnapshot(`""`)
  })

  test('processes both metafields and metaobjects together', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, metaobjectNodes)

    expect(result.metafieldCount).toBe(1)
    expect(result.metaobjectCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields]
      foo = \\"single_line_text_field\\"

      # namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('handles metafields where name equals key', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            key: 'samename',
            name: 'samename',
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: samename owner_type: PRODUCT
      [product.metafields.app.samename]
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
    // Should not contain name since it equals key
    expect(result.tomlContent).not.toContain('name = "samename"')
  })

  test('handles complex validation types', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            validations: [
              {name: 'simple_string', value: '"test"'},
              {name: 'simple_number', value: '42'},
              {name: 'simple_boolean', value: 'true'},
              {name: 'array_strings', value: '["a", "b"]'},
              {name: 'complex_object', value: '{"nested": {"value": 123}}'},
            ],
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      [product.metafields.app.color.validations]
      simple_string = \\"test\\"
      simple_number = 42
      simple_boolean = true
      array_strings = [\\"a\\", \\"b\\"]
      complex_object = '{\\"nested\\":{\\"value\\":123}}'
      "
    `)
  })

  test('handles metafields with undefined or null descriptions', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            description: null,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      "
    `)
    expect(result.tomlContent).not.toContain('description =')
  })

  test('handles metafields with empty validations array', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            validations: [],
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('handles metaobject fields with different types', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
        fieldDefinitions: [
          {
            key: 'price_field',
            name: 'Price',
            required: false,
            type: {
              category: 'money',
              name: 'money',
            },
            validations: [],
          },
        ],
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.metaobjectCount).toBe(1)
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields.price_field]
      type = \\"money\\"
      name = \\"Price\\"
      "
    `)
  })

  test('handles metafields with validations that have null values', () => {
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            validations: [
              {name: 'min', value: '5'},
              {name: 'max', value: null},
            ],
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      [product.metafields.app.color.validations]
      min = 5
      "
    `)
    // Should skip validations with null values
    expect(result.tomlContent).not.toContain('max =')
  })

  test('handles metaobjects with all access set to null', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
        access: {
          admin: 'MERCHANT_READ',
          storefront: 'NONE',
        },
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields]
      foo = \\"single_line_text_field\\"
      "
    `)
  })

  test('handles metaobjects without renderable capability', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
        capabilities: {
          ...defaultMetaobjectFragment.capabilities,
          renderable: null,
        },
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields]
      foo = \\"single_line_text_field\\"
      "
    `)
  })

  test('handles fields with metaobject reference validations', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
        fieldDefinitions: [
          {
            key: 'price_field',
            name: 'Price',
            required: false,
            type: {
              category: 'reference',
              name: 'list.metaobject_reference',
            },
            validations: [
              {
                name: 'metaobject_definition_type',
                value: 'app--297771827201--referenced_into',
              },
              {
                name: 'metaobject_definition_id',
                value: 'gid://shopify/MetaobjectDefinition/29112238410',
              },
              {
                name: 'list.max',
                value: '3',
              },
            ],
          },
        ],
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields.price_field]
      type = \\"list.metaobject_reference<$app:referenced_into>\\"
      name = \\"Price\\"

      [metaobjects.app.test.fields.price_field.validations]
      \\"list.max\\" = 3
      "
    `)
  })

  test('handles fields with mixed reference validations', () => {
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        type: 'app--345678--test',
        ...defaultMetaobjectFragment,
        fieldDefinitions: [
          {
            key: 'price_field',
            name: 'Price',
            required: false,
            type: {
              category: 'reference',
              name: 'mixed_reference',
            },
            validations: [
              {
                name: 'metaobject_definition_types',
                value: '["app--297771827201--referenced_into","app--297771827201--referenced_into2"]',
              },
              {
                name: 'metaobject_definition_ids',
                value:
                  '["gid://shopify/MetaobjectDefinition/29112238410","gid://shopify/MetaobjectDefinition/29113090378"]',
              },
            ],
          },
        ],
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:test
      [metaobjects.app.test.fields.price_field]
      type = \\"mixed_reference<$app:referenced_into,$app:referenced_into2>\\"
      name = \\"Price\\"
      "
    `)
  })
})
