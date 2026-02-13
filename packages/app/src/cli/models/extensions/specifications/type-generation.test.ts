import {createToolsTypeDefinition} from './type-generation.js'
import {AbortError} from '@shopify/cli-kit/shared/node/error'
import {describe, expect, test} from 'vitest'

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
  register(name: 'get_product', handler: (input: GetProductInput) => GetProductOutput | Promise<GetProductOutput>);
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
  register(name: 'simple_action', handler: (input: SimpleActionInput) => SimpleActionOutput | Promise<SimpleActionOutput>);
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
  register(name: 'tool_one', handler: (input: ToolOneInput) => ToolOneOutput | Promise<ToolOneOutput>);
  /**
   * Second tool
   */
  register(name: 'tool_two', handler: (input: ToolTwoInput) => ToolTwoOutput | Promise<ToolTwoOutput>);
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
  register(name: 'tool_with_special_desc', handler: (input: ToolWithSpecialDescInput) => ToolWithSpecialDescOutput | Promise<ToolWithSpecialDescOutput>);
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
  register(name: 'documented_tool', handler: (input: DocumentedToolInput) => DocumentedToolOutput | Promise<DocumentedToolOutput>);
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
  register(name: 'my_snake_case_tool', handler: (input: MySnakeCaseToolInput) => MySnakeCaseToolOutput | Promise<MySnakeCaseToolOutput>);
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
  register(name: 'complex_tool', handler: (input: ComplexToolInput) => ComplexToolOutput | Promise<ComplexToolOutput>);
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
  register(name: 'get-product-info', handler: (input: GetProductInfoInput) => GetProductInfoOutput | Promise<GetProductInfoOutput>);
}
`)
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
