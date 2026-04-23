import {
  createIntentsTypeDefinition,
  createToolsTypeDefinition,
  getGeneratedTypesHelperImportPath,
} from './type-generation.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

const adminGeneratedTypesHelperImportPath = '@shopify/ui-extensions/admin'

describe('getGeneratedTypesHelperImportPath', () => {
  test('returns the surface package for generated helper types', () => {
    expect(getGeneratedTypesHelperImportPath(['admin.app.intent.render'])).toBe('@shopify/ui-extensions/admin')
    expect(getGeneratedTypesHelperImportPath(['purchase.checkout.block.render'])).toBe(
      '@shopify/ui-extensions/checkout',
    )
    expect(getGeneratedTypesHelperImportPath(['pos.home.tile.render'])).toBe('@shopify/ui-extensions/point-of-sale')
    expect(getGeneratedTypesHelperImportPath(['customer-account.order-status.block.render'])).toBe(
      '@shopify/ui-extensions/customer-account',
    )
  })
})

describe('createIntentsTypeDefinition', () => {
  test('returns empty string when intents array is empty', async () => {
    // When
    const result = await createIntentsTypeDefinition([], {
      generatedTypesHelperImportPath: adminGeneratedTypesHelperImportPath,
    })

    // Then
    expect(result).toBe('')
  })

  test('generates request and response types for a single intent schema', async () => {
    // Given
    const intents = [
      {
        action: 'create',
        type: 'application/email',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: {type: 'string'},
          },
          required: ['recipient'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: {type: 'boolean'},
          },
        },
      },
    ]

    // When
    const result = await createIntentsTypeDefinition(intents, {
      generatedTypesHelperImportPath: adminGeneratedTypesHelperImportPath,
    })

    // Then
    expect(result).toBe(`interface CreateApplicationEmailIntentInput {
  recipient: string;
  [k: string]: unknown;
}

type CreateApplicationEmailIntentValue = unknown
interface CreateApplicationEmailIntentOutput {
  success?: boolean;
  [k: string]: unknown;
}

interface CreateApplicationEmailIntentRequest {
  action: "create";
  type: "application/email";
  data: CreateApplicationEmailIntentInput;
  value?: CreateApplicationEmailIntentValue;
}

type ShopifyGeneratedIntentVariants =
  | import('@shopify/ui-extensions/admin').ShopifyGeneratedIntentVariant<CreateApplicationEmailIntentRequest, CreateApplicationEmailIntentOutput>
`)
  })

  test('supports multiple intents with value schemas', async () => {
    // Given
    const intents = [
      {
        action: 'create',
        type: 'application/email',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: {type: 'string'},
          },
        },
      },
      {
        action: 'edit',
        type: 'shopify/Product',
        valueSchema: {
          type: 'string',
        },
        inputSchema: {
          type: 'object',
          properties: {
            title: {type: 'string'},
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: {type: 'string'},
          },
        },
      },
    ]

    // When
    const result = await createIntentsTypeDefinition(intents, {
      generatedTypesHelperImportPath: adminGeneratedTypesHelperImportPath,
    })

    // Then
    expect(result).toContain('interface CreateApplicationEmailIntentRequest')
    expect(result).toContain('type CreateApplicationEmailIntentOutput = unknown')
    expect(result).toContain('interface EditShopifyProductIntentRequest')
    expect(result).toContain('type EditShopifyProductIntentValue = string')
    expect(result).not.toContain('ShopifyGeneratedIntentsApi')
    expect(result).toContain(
      "import('@shopify/ui-extensions/admin').ShopifyGeneratedIntentVariant<EditShopifyProductIntentRequest, EditShopifyProductIntentOutput>",
    )
  })

  test('throws AbortError when intent action/type pairs are duplicated', async () => {
    // Given
    const intents = [
      {
        action: 'create',
        type: 'application/email',
        inputSchema: {type: 'object'},
      },
      {
        action: 'create',
        type: 'application/email',
        inputSchema: {type: 'object'},
      },
    ]

    // When & Then
    await expect(
      createIntentsTypeDefinition(intents, {generatedTypesHelperImportPath: adminGeneratedTypesHelperImportPath}),
    ).rejects.toThrow(
      new AbortError(
        'Intent "create:application/email" is defined multiple times. Intents must be unique within a target.',
      ),
    )
  })
})

describe('createToolsTypeDefinition', () => {
  test('returns empty string when tools array is empty', async () => {
    // When
    const result = await createToolsTypeDefinition([])

    // Then
    expect(result).toBe('')
  })

  test('generates type definitions for a single tool with input and output schemas', async () => {
    // Given
    const tools = [
      {
        name: 'get_product',
        description: 'Gets a product by ID',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {type: 'string'},
          },
          required: ['productId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            title: {type: 'string'},
            price: {type: 'number'},
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface GetProductInput {
  productId: string;
  [k: string]: unknown;
}

interface GetProductOutput {
  title?: string;
  price?: number;
  [k: string]: unknown;
}

interface ShopifyTools {
  /**
   * Gets a product by ID
   */
  register(name: 'get_product', handler: (input: GetProductInput) => GetProductOutput | Promise<GetProductOutput>): () => void;
}
`)
  })

  test('generates unknown type when outputSchema is not provided', async () => {
    // Given
    const tools = [
      {
        name: 'simple_action',
        description: 'A simple action',
        inputSchema: {
          type: 'object',
          properties: {
            data: {type: 'string'},
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface SimpleActionInput {
  data?: string;
  [k: string]: unknown;
}

type SimpleActionOutput = unknown
interface ShopifyTools {
  /**
   * A simple action
   */
  register(name: 'simple_action', handler: (input: SimpleActionInput) => SimpleActionOutput | Promise<SimpleActionOutput>): () => void;
}
`)
  })

  test('generates type definitions for multiple tools', async () => {
    // Given
    const tools = [
      {
        name: 'tool_one',
        description: 'First tool',
        inputSchema: {
          type: 'object',
          properties: {
            arg1: {type: 'string'},
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            result1: {type: 'string'},
          },
        },
      },
      {
        name: 'tool_two',
        description: 'Second tool',
        inputSchema: {
          type: 'object',
          properties: {
            arg2: {type: 'number'},
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            result2: {type: 'boolean'},
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface ToolOneInput {
  arg1?: string;
  [k: string]: unknown;
}

interface ToolOneOutput {
  result1?: string;
  [k: string]: unknown;
}

interface ToolTwoInput {
  arg2?: number;
  [k: string]: unknown;
}

interface ToolTwoOutput {
  result2?: boolean;
  [k: string]: unknown;
}

interface ShopifyTools {
  /**
   * First tool
   */
  register(name: 'tool_one', handler: (input: ToolOneInput) => ToolOneOutput | Promise<ToolOneOutput>): () => void;
  /**
   * Second tool
   */
  register(name: 'tool_two', handler: (input: ToolTwoInput) => ToolTwoOutput | Promise<ToolTwoOutput>): () => void;
}
`)
  })

  test('throws AbortError when tool names are duplicated', async () => {
    // Given
    const tools = [
      {
        name: 'duplicate_tool',
        description: 'First instance',
        inputSchema: {type: 'object'},
      },
      {
        name: 'duplicate_tool',
        description: 'Second instance',
        inputSchema: {type: 'object'},
      },
    ]

    // When & Then
    await expect(createToolsTypeDefinition(tools)).rejects.toThrow(
      new AbortError(
        'Tool name "duplicate_tool" is defined multiple times. Tool names must be unique within a tools file.',
      ),
    )
  })

  test('escapes closing comment markers in descriptions', async () => {
    // Given
    const tools = [
      {
        name: 'tool_with_special_desc',
        description: 'This description contains */ which could break comments',
        inputSchema: {type: 'object'},
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface ToolWithSpecialDescInput {
  [k: string]: unknown;
}

type ToolWithSpecialDescOutput = unknown
interface ShopifyTools {
  /**
   * This description contains *\\/ which could break comments
   */
  register(name: 'tool_with_special_desc', handler: (input: ToolWithSpecialDescInput) => ToolWithSpecialDescOutput | Promise<ToolWithSpecialDescOutput>): () => void;
}
`)
  })

  test('handles multi-line descriptions', async () => {
    // Given
    const tools = [
      {
        name: 'documented_tool',
        description: 'Line one\nLine two\nLine three',
        inputSchema: {type: 'object'},
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface DocumentedToolInput {
  [k: string]: unknown;
}

type DocumentedToolOutput = unknown
interface ShopifyTools {
  /**
   * Line one
   * Line two
   * Line three
   */
  register(name: 'documented_tool', handler: (input: DocumentedToolInput) => DocumentedToolOutput | Promise<DocumentedToolOutput>): () => void;
}
`)
  })

  test('converts multi-segment snake_case tool names to PascalCase type names', async () => {
    // Given
    const tools = [
      {
        name: 'my_snake_case_tool',
        description: 'A tool with snake case name',
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface MySnakeCaseToolInput {
  [k: string]: unknown;
}

interface MySnakeCaseToolOutput {
  [k: string]: unknown;
}

interface ShopifyTools {
  /**
   * A tool with snake case name
   */
  register(name: 'my_snake_case_tool', handler: (input: MySnakeCaseToolInput) => MySnakeCaseToolOutput | Promise<MySnakeCaseToolOutput>): () => void;
}
`)
  })

  test('handles complex nested schemas', async () => {
    // Given
    const tools = [
      {
        name: 'complex_tool',
        description: 'A tool with nested schema',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: {type: 'string'},
                email: {type: 'string'},
              },
              required: ['name'],
            },
            tags: {
              type: 'array',
              items: {type: 'string'},
            },
          },
          required: ['user'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: {type: 'boolean'},
            data: {
              type: 'object',
              properties: {
                id: {type: 'number'},
              },
            },
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface ComplexToolInput {
  user: {
    name: string;
    email?: string;
    [k: string]: unknown;
  };
  tags?: string[];
  [k: string]: unknown;
}

interface ComplexToolOutput {
  success?: boolean;
  data?: {
    id?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface ShopifyTools {
  /**
   * A tool with nested schema
   */
  register(name: 'complex_tool', handler: (input: ComplexToolInput) => ComplexToolOutput | Promise<ComplexToolOutput>): () => void;
}
`)
  })

  test('preserves tool name exactly in register method', async () => {
    // Given
    const tools = [
      {
        name: 'get-product-info',
        description: 'Gets product info',
        inputSchema: {type: 'object'},
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toBe(`interface GetProductInfoInput {
  [k: string]: unknown;
}

type GetProductInfoOutput = unknown
interface ShopifyTools {
  /**
   * Gets product info
   */
  register(name: 'get-product-info', handler: (input: GetProductInfoInput) => GetProductInfoOutput | Promise<GetProductInfoOutput>): () => void;
}
`)
  })

  test('renames types generated from schemas with titles to the requested generated name', async () => {
    // Given
    const tools = [
      {
        name: 'expected_tool',
        description: 'A tool with schema titles',
        inputSchema: {
          title: 'SchemaTitleInput',
          type: 'object',
          properties: {
            id: {type: 'string'},
          },
        },
        outputSchema: {
          title: 'SchemaTitleOutput',
          type: 'object',
          properties: {
            success: {type: 'boolean'},
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).toContain('interface ExpectedToolInput')
    expect(result).toContain('interface ExpectedToolOutput')
    expect(result).not.toContain('interface SchemaTitleInput')
    expect(result).not.toContain('interface SchemaTitleOutput')
  })

  test('does not include export declarations in the output', async () => {
    // Given
    // We need to ensure export declarations are stripped from the output since these types
    // are embedded inside a declare module block.
    const tools = [
      {
        name: 'exportable_tool',
        description: 'A tool that might generate exports',
        inputSchema: {
          type: 'object',
          properties: {
            id: {type: 'string'},
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: {type: 'boolean'},
          },
        },
      },
    ]

    // When
    const result = await createToolsTypeDefinition(tools)

    // Then
    expect(result).not.toMatch(/\bexport\b/)
  })
})
