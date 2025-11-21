import {
  processDeclarativeDefinitionNodes,
  MetafieldNodesInput,
  renderTomlStringWithFormatting,
  paginatedQuery,
  importDeclarativeDefinitions,
} from './declarative-definitions.js'
import {
  MetaobjectDefinitions,
  MetaobjectDefinitionsQuery,
  MetaobjectForImportFragment,
} from '../../../api/graphql/admin/generated/metaobject_definitions.js'
import {
  MetafieldDefinitions,
  MetafieldDefinitionsQuery,
  MetafieldForImportFragment,
} from '../../../api/graphql/admin/generated/metafield_definitions.js'
import {adminAsAppRequestDoc} from '../../../api/admin-as-app.js'
import {describe, expect, test, vi} from 'vitest'
import * as output from '@shopify/cli-kit/node/output'
import {stringifyMessage} from '@shopify/cli-kit/node/output'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {AdminSession, ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../api/admin-as-app.js')
vi.mock('@shopify/cli-kit/node/session')

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

  test('handles metafields with app--123456 namespace (no custom segment)', () => {
    // This tests the case where namespace is just "app--123456" without a trailing custom segment
    // The simplifyAppReservedNamespace function should return 'app' in this case
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            // No trailing segment like "--custom"
            namespace: 'app--999999',
            ...defaultMetafieldFragment,
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(1)
    // Should use 'app' as the namespace key since there's no custom segment
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"
      "
    `)
  })

  test('handles metaobjects with app--123456 type (no custom segment)', () => {
    // Test metaobject where type is "app--123456" without trailing segment
    const metaobjectNodes: MetaobjectForImportFragment[] = [
      {
        // No trailing segment
        type: 'app--999999',
        ...defaultMetaobjectFragment,
      } as MetaobjectForImportFragment,
    ]

    const result = processDeclarativeDefinitionNodes([], metaobjectNodes)

    expect(result.metaobjectCount).toBe(1)
    // Should use 'app' as the type name. Name is included since it differs from typeName ('app')
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# type: $app:app
      [metaobjects.app.app]
      name = \\"test\\"

      [metaobjects.app.app.fields]
      foo = \\"single_line_text_field\\"
      "
    `)
  })

  test('handles validations with invalid JSON values', () => {
    // This tests the catch block in validationsNodeToObject
    const metafieldNodes: MetafieldNodesInput[] = [
      {
        ownerType: 'product',
        graphQLOwner: 'PRODUCT',
        items: [
          {
            namespace: 'app--123456',
            ...defaultMetafieldFragment,
            validations: [
              {name: 'valid_json', value: '42'},
              // Invalid JSON - should be returned as-is
              {name: 'invalid_json', value: 'this is not valid json {{'},
            ],
          } as MetafieldForImportFragment,
        ],
      },
    ]

    const result = processDeclarativeDefinitionNodes(metafieldNodes, [])

    expect(result.metafieldCount).toBe(1)
    // Invalid JSON should be returned as the raw string
    expect(result.tomlContent).toMatchInlineSnapshot(`
      "# namespace: $app key: color owner_type: PRODUCT
      [product.metafields.app.color]
      name = \\"Color\\"
      type = \\"single_line_text_field\\"
      description = \\"The color of the product\\"

      [product.metafields.app.color.validations]
      valid_json = 42
      invalid_json = \\"this is not valid json {{\\"
      "
    `)
  })

  test('handles metafields with customerAccount READ_WRITE access', () => {
    // This tests the READ_WRITE case in graphQLToCustomerAccountAccess
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
              // Testing the READ_WRITE case
              customerAccount: 'READ_WRITE',
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
      access.customer_account = \\"read_write\\"
      "
    `)
  })
})

describe('renderTomlStringWithFormatting', () => {
  test('renders TOML with colored formatting for different line types', () => {
    const capturedOutput: string[] = []
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation((content) => {
      capturedOutput.push(stringifyMessage(content))
    })

    const tomlContent = `# comment line
[section.header]
key = "value"
plain line`

    renderTomlStringWithFormatting(tomlContent)

    expect(capturedOutput).toMatchInlineSnapshot(`
      [
        "[90m# comment line[39m",
        "[32m[section.header][39m",
        "key = \\"value\\"",
        "plain line",
      ]
    `)

    outputInfoSpy.mockRestore()
  })

  test('handles empty TOML content', () => {
    const capturedOutput: string[] = []
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation((content) => {
      capturedOutput.push(stringifyMessage(content))
    })

    renderTomlStringWithFormatting('')

    expect(capturedOutput).toMatchInlineSnapshot(`
      [
        "",
      ]
    `)

    outputInfoSpy.mockRestore()
  })

  test('handles TOML with indented headers and comments', () => {
    const capturedOutput: string[] = []
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation((content) => {
      capturedOutput.push(stringifyMessage(content))
    })

    const tomlContent = `  [indented.header]
  # indented comment
regular line`

    renderTomlStringWithFormatting(tomlContent)

    expect(capturedOutput).toMatchInlineSnapshot(`
      [
        "[32m  [indented.header][39m",
        "[90m  # indented comment[39m",
        "regular line",
      ]
    `)

    outputInfoSpy.mockRestore()
  })
})

describe('paginatedQuery', () => {
  // Mock query and session for testing
  const mockQuery = {} as TypedDocumentNode<unknown, {cursor?: string | null}>
  const mockSession = {storeFqdn: 'test.myshopify.com'} as AdminSession

  test('returns items from a single page result', async () => {
    const mockPerformQuery = vi.fn().mockResolvedValue({data: ['item1', 'item2']})

    const result = await paginatedQuery({
      query: mockQuery,
      session: mockSession,
      toNodes: (res) => ({
        pageInfo: {hasNextPage: false, endCursor: null},
        nodes: (res as {data: string[]}).data,
      }),
      toVariables: (cursor) => ({cursor}),
      performQuery: mockPerformQuery,
    })

    expect(result).toEqual({status: 'ok', items: ['item1', 'item2']})
    expect(mockPerformQuery).toHaveBeenCalledTimes(1)
  })

  test('aggregates items from multiple pages', async () => {
    const mockPerformQuery = vi
      .fn()
      .mockResolvedValueOnce({data: ['page1-item1', 'page1-item2'], hasNext: true, cursor: 'cursor1'})
      .mockResolvedValueOnce({data: ['page2-item1'], hasNext: false, cursor: null})

    const result = await paginatedQuery({
      query: mockQuery,
      session: mockSession,
      toNodes: (res) => {
        const response = res as {data: string[]; hasNext: boolean; cursor: string | null}
        return {
          pageInfo: {hasNextPage: response.hasNext, endCursor: response.cursor},
          nodes: response.data,
        }
      },
      toVariables: (cursor) => ({cursor}),
      performQuery: mockPerformQuery,
    })

    expect(result).toEqual({status: 'ok', items: ['page1-item1', 'page1-item2', 'page2-item1']})
    expect(mockPerformQuery).toHaveBeenCalledTimes(2)
    expect(mockPerformQuery).toHaveBeenNthCalledWith(1, {cursor: undefined})
    expect(mockPerformQuery).toHaveBeenNthCalledWith(2, {cursor: 'cursor1'})
  })

  test('returns scope_error when ACCESS_DENIED error occurs', async () => {
    const mockPerformQuery = vi.fn().mockRejectedValue(new Error('ACCESS_DENIED: Missing required scope'))

    const result = await paginatedQuery({
      query: mockQuery,
      session: mockSession,
      toNodes: (res) => ({pageInfo: {hasNextPage: false}, nodes: [res]}),
      toVariables: (cursor) => ({cursor}),
      performQuery: mockPerformQuery,
    })

    expect(result).toEqual({status: 'scope_error'})
  })

  test('rethrows non-ACCESS_DENIED errors', async () => {
    const mockPerformQuery = vi.fn().mockRejectedValue(new Error('Some other error'))

    await expect(
      paginatedQuery({
        query: mockQuery,
        session: mockSession,
        toNodes: (res) => ({pageInfo: {hasNextPage: false}, nodes: [res]}),
        toVariables: (cursor) => ({cursor}),
        performQuery: mockPerformQuery,
      }),
    ).rejects.toThrow('Some other error')
  })

  test('handles non-Error rejections gracefully', async () => {
    // When the rejection is not an Error instance, it should be rethrown
    const mockPerformQuery = vi.fn().mockRejectedValue('string rejection')

    await expect(
      paginatedQuery({
        query: mockQuery,
        session: mockSession,
        toNodes: (res) => ({pageInfo: {hasNextPage: false}, nodes: [res]}),
        toVariables: (cursor) => ({cursor}),
        performQuery: mockPerformQuery,
      }),
    ).rejects.toBe('string rejection')
  })
})

describe('importDeclarativeDefinitions', () => {
  test('imports metafields and metaobjects from a shop and outputs TOML', async () => {
    const outputMock = mockAndCaptureOutput()

    vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue({
      storeFqdn: 'test-shop.myshopify.com',
      token: 'test-token',
    })

    // Mock the paginated queries - metafields for each owner type and metaobjects
    vi.mocked(adminAsAppRequestDoc).mockImplementation(async ({query}) => {
      if (query === MetafieldDefinitions) {
        return {
          metafieldDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes: [],
          },
        }
      }
      if (query === MetaobjectDefinitions) {
        return {
          metaobjectDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes: [],
          },
        }
      }
      return {}
    })

    await importDeclarativeDefinitions({
      remoteApp: {
        apiKey: 'test-api-key',
        apiSecretKeys: [{secret: 'test-secret'}],
      },
      store: {
        shopDomain: 'test-shop.myshopify.com',
      },
      appConfiguration: {},
    } as any)

    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Conversion to TOML complete.                                                │
      │                                                                              │
      │  Converted 0 metafields and 0 metaobjects from test-shop.myshopify.com into  │
      │   TOML, ready for you to copy.                                               │
      │                                                                              │
      │  Next steps                                                                  │
      │    1. Review the suggested TOML carefully before applying.                   │
      │    2. Missing sections? Make sure your app has the required access scopes    │
      │       to load metafields and metaobjects (e.g. \`read_customers\` to load      │
      │       customer metafields, \`read_metaobject_definitions\` to load             │
      │       metaobjects.)                                                          │
      │    3. Missing definitions? Only metafields and metaobjects that are          │
      │       app-reserved (using \`$app\` ) will be converted.                        │
      │    4. When you're ready, add the generated TOML to your app's configuration  │
      │       file and test out changes with the \`shopify app dev\` command.          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯

      "
    `)
    outputMock.clear()
  })

  test('throws BugError when app has no API secret keys', async () => {
    const importPromised = importDeclarativeDefinitions({
      remoteApp: {
        apiKey: 'test-api-key',
        apiSecretKeys: [],
      },
      store: {
        shopDomain: 'test-shop.myshopify.com',
      },
    } as any)
    await expect(importPromised).rejects.toThrow('No API secret keys found for app')
  })

  test('existing definitions are not included in the output', async () => {
    const outputMock = mockAndCaptureOutput()

    vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue({
      storeFqdn: 'test-shop.myshopify.com',
      token: 'test-token',
    })

    vi.mocked(adminAsAppRequestDoc).mockImplementation(async ({query, variables}) => {
      if (query === MetafieldDefinitions && variables?.ownerType === 'PRODUCT') {
        return {
          metafieldDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes: [
              {
                key: 'existing',
                name: 'existing',
                namespace: 'app--345678',
                type: {
                  category: 'string',
                  name: 'single_line_text_field',
                },
                access: {
                  customerAccount: 'NONE',
                },
                capabilities: {
                  adminFilterable: {
                    enabled: false,
                  },
                },
                validations: [],
              },
              {
                key: 'new',
                name: 'new',
                namespace: 'app--345678',
                type: {
                  category: 'string',
                  name: 'single_line_text_field',
                },
                access: {
                  customerAccount: 'NONE',
                },
                capabilities: {
                  adminFilterable: {
                    enabled: false,
                  },
                },
                validations: [],
              },
            ],
          },
        } as MetafieldDefinitionsQuery
      }
      if (query === MetafieldDefinitions) {
        return {
          metafieldDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes: [],
          },
        } as MetafieldDefinitionsQuery
      }
      if (query === MetaobjectDefinitions) {
        return {
          metaobjectDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes: [
              {
                type: 'app--345678--existing',
                name: 'existing',
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
                    key: 'field',
                    name: 'field',
                    required: false,
                    type: {
                      category: 'string',
                      name: 'single_line_text_field',
                    },
                    validations: [],
                  },
                ],
              },
              {
                type: 'app--345678--new',
                name: 'new',
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
                    key: 'field',
                    name: 'field',
                    required: false,
                    type: {
                      category: 'string',
                      name: 'single_line_text_field',
                    },
                    validations: [],
                  },
                ],
              },
            ],
          },
        } as MetaobjectDefinitionsQuery
      }
      return {}
    })

    const options = {
      remoteApp: {
        apiKey: 'test-api-key',
        apiSecretKeys: [{secret: 'test-secret'}],
      },
      store: {
        shopDomain: 'test-shop.myshopify.com',
      },
      appConfiguration: {
        product: {
          metafields: {
            app: {
              existing: {
                type: 'single_line_text_field',
              },
            },
          },
        },
        metaobjects: {
          app: {
            existing: {
              fields: {
                existing: 'single_line_text_field',
              },
            },
          },
        },
      },
    }

    await importDeclarativeDefinitions({
      ...options,
      includeExistingDeclaredDefinitions: false,
    } as any)

    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Conversion to TOML complete.                                                │
      │                                                                              │
      │  Converted 1 metafields and 1 metaobjects from test-shop.myshopify.com into  │
      │   TOML, ready for you to copy.                                               │
      │                                                                              │
      │  Next steps                                                                  │
      │    1. Review the suggested TOML carefully before applying.                   │
      │    2. Missing sections? Make sure your app has the required access scopes    │
      │       to load metafields and metaobjects (e.g. \`read_customers\` to load      │
      │       customer metafields, \`read_metaobject_definitions\` to load             │
      │       metaobjects.)                                                          │
      │    3. Missing definitions? Only metafields and metaobjects that are          │
      │       app-reserved (using \`$app\` ) will be converted.                        │
      │    4. When you're ready, add the generated TOML to your app's configuration  │
      │       file and test out changes with the \`shopify app dev\` command.          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯

      # type: $app:new
      [metaobjects.app.new.fields]
      field = \\"single_line_text_field\\"

      # namespace: $app key: new owner_type: PRODUCT
      [product.metafields.app.new]
      type = \\"single_line_text_field\\"
      "
    `)
    outputMock.clear()

    await importDeclarativeDefinitions({
      ...options,
      includeExistingDeclaredDefinitions: true,
    } as any)

    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Conversion to TOML complete.                                                │
      │                                                                              │
      │  Converted 2 metafields and 2 metaobjects from test-shop.myshopify.com into  │
      │   TOML, ready for you to copy.                                               │
      │                                                                              │
      │  Next steps                                                                  │
      │    1. Review the suggested TOML carefully before applying.                   │
      │    2. Missing sections? Make sure your app has the required access scopes    │
      │       to load metafields and metaobjects (e.g. \`read_customers\` to load      │
      │       customer metafields, \`read_metaobject_definitions\` to load             │
      │       metaobjects.)                                                          │
      │    3. Missing definitions? Only metafields and metaobjects that are          │
      │       app-reserved (using \`$app\` ) will be converted.                        │
      │    4. When you're ready, add the generated TOML to your app's configuration  │
      │       file and test out changes with the \`shopify app dev\` command.          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯

      # type: $app:existing
      [metaobjects.app.existing.fields]
      field = \\"single_line_text_field\\"

      # type: $app:new
      [metaobjects.app.new.fields]
      field = \\"single_line_text_field\\"

      # namespace: $app key: existing owner_type: PRODUCT
      [product.metafields.app.existing]
      type = \\"single_line_text_field\\"

      # namespace: $app key: new owner_type: PRODUCT
      [product.metafields.app.new]
      type = \\"single_line_text_field\\"
      "
    `)
    outputMock.clear()
  })
})
