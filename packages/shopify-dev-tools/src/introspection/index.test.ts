import { afterAll, beforeAll, describe, expect, it, test, vi } from "vitest";

import {
  APIVersionWithAPI,
  formatScopes,
  loadAPISchemas,
} from "../schemaOperations/index.js";
import { APICategory, getApiIdsByCategory } from "../types/index.js";
import { __testExports, introspectGraphqlSchema } from "./index.js";

const {
  MAX_FIELDS_TO_SHOW,
  formatType,
  formatArg,
  formatField,
  formatSchemaType,
  formatGraphqlOperation,
  filterAndSortItems,
  filterDeprecatedArgs,
  filterDeprecatedFields,
  SmartTruncationManager,
  MIN_DESCRIPTION_LENGTH,
} = __testExports;

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

// Mock offline scopes data for unit tests
const mockOfflineScopes: import("../schemaOperations/types.js").OfflineScopeData =
  {
    items: [],
  };

afterAll(() => {
  console.error = originalConsoleError;
});

describe("formatType", () => {
  test("formats scalar types", () => {
    const type = { kind: "SCALAR", name: "String", ofType: null };
    expect(formatType(type)).toBe("String");
  });

  test("formats non-null types", () => {
    const type = {
      kind: "NON_NULL",
      name: null,
      ofType: { kind: "SCALAR", name: "String", ofType: null },
    };
    expect(formatType(type)).toBe("String!");
  });

  test("formats list types", () => {
    const type = {
      kind: "LIST",
      name: null,
      ofType: { kind: "SCALAR", name: "String", ofType: null },
    };
    expect(formatType(type)).toBe("[String]");
  });

  test("formats complex nested types", () => {
    const type = {
      kind: "NON_NULL",
      name: null,
      ofType: {
        kind: "LIST",
        name: null,
        ofType: {
          kind: "NON_NULL",
          name: null,
          ofType: { kind: "OBJECT", name: "Product", ofType: null },
        },
      },
    };
    expect(formatType(type)).toBe("[Product!]!");
  });

  test("handles null input", () => {
    expect(formatType(null)).toBe("null");
  });
});

describe("formatArg", () => {
  test("formats basic argument", () => {
    const arg = {
      name: "id",
      type: { kind: "SCALAR", name: "ID", ofType: null },
      defaultValue: null,
    };
    expect(formatArg(arg)).toBe("id: ID");
  });

  test("formats argument with default value", () => {
    const arg = {
      name: "first",
      type: { kind: "SCALAR", name: "Int", ofType: null },
      defaultValue: "10",
    };
    expect(formatArg(arg)).toBe("first: Int = 10");
  });

  test("formats argument with complex type", () => {
    const arg = {
      name: "input",
      type: {
        kind: "NON_NULL",
        name: null,
        ofType: { kind: "INPUT_OBJECT", name: "ProductInput", ofType: null },
      },
      defaultValue: null,
    };
    expect(formatArg(arg)).toBe("input: ProductInput!");
  });
});

describe("filterDeprecatedArgs", () => {
  test("filters out deprecated arguments", () => {
    const args = [
      {
        name: "id",
        type: { kind: "SCALAR", name: "ID", ofType: null },
        isDeprecated: false,
        deprecationReason: null,
      },
      {
        name: "legacyId",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: true,
        deprecationReason: "Use id instead",
      },
      {
        name: "oldField",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: false,
        deprecationReason: "This is deprecated", // Has deprecationReason but isDeprecated is false
      },
    ];

    const result = filterDeprecatedArgs(args);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("id");
  });

  test("handles null or undefined input", () => {
    expect(filterDeprecatedArgs(null as any)).toEqual([]);
    expect(filterDeprecatedArgs(undefined as any)).toEqual([]);
  });

  test("returns empty array when all arguments are deprecated", () => {
    const args = [
      {
        name: "oldId",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: true,
        deprecationReason: "Deprecated",
      },
    ];

    const result = filterDeprecatedArgs(args);
    expect(result.length).toBe(0);
  });
});

describe("filterDeprecatedFields", () => {
  test("filters out deprecated fields", () => {
    const fields = [
      {
        name: "id",
        type: { kind: "SCALAR", name: "ID", ofType: null },
        isDeprecated: false,
        deprecationReason: null,
      },
      {
        name: "legacyField",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: true,
        deprecationReason: "Use newField instead",
      },
      {
        name: "title",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: false,
        deprecationReason: null,
      },
    ];

    const result = filterDeprecatedFields(fields);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("id");
    expect(result[1].name).toBe("title");
  });

  test("handles null or undefined input", () => {
    expect(filterDeprecatedFields(null as any)).toEqual([]);
    expect(filterDeprecatedFields(undefined as any)).toEqual([]);
  });

  test("returns empty array when all fields are deprecated", () => {
    const fields = [
      {
        name: "oldField",
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: true,
        deprecationReason: "Deprecated",
      },
    ];

    const result = filterDeprecatedFields(fields);
    expect(result.length).toBe(0);
  });
});

describe("formatField", () => {
  test("formats basic field", () => {
    const field = {
      name: "id",
      args: [],
      type: { kind: "SCALAR", name: "ID", ofType: null },
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe("    id: ID");
  });

  test("formats field with description", () => {
    const field = {
      name: "id",
      args: [],
      type: { kind: "SCALAR", name: "ID", ofType: null },
      description: "The unique identifier for the resource",
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe(
      "    id: ID\n      # The unique identifier for the resource",
    );
  });

  test("truncates long field descriptions", () => {
    const field = {
      name: "title",
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
      description:
        "This is an extremely long description that needs to be even longer now to test the new 200 character limit. We need to add more text to make sure it exceeds the new threshold. This description should definitely be truncated because it goes way beyond the maximum allowed length for field descriptions.",
      isDeprecated: false,
      deprecationReason: null,
    };
    const result = formatField(field);
    expect(result).toContain("    title: String");
    expect(result).toContain("#");
    // With no truncation manager, the full description is shown
    expect(result).toContain("goes way beyond");
  });

  test("formats field with arguments", () => {
    const field = {
      name: "product",
      args: [
        {
          name: "id",
          type: { kind: "SCALAR", name: "ID", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe("    product(id: ID): Product");
  });

  test("formats field with arguments and description", () => {
    const field = {
      name: "product",
      args: [
        {
          name: "id",
          type: { kind: "SCALAR", name: "ID", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
      description: "Fetches a product by ID",
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe(
      "    product(id: ID): Product\n      # Fetches a product by ID",
    );
  });

  test("filters out deprecated arguments", () => {
    const field = {
      name: "product",
      args: [
        {
          name: "id",
          type: { kind: "SCALAR", name: "ID", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "legacyId",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: true,
          deprecationReason: "Use id instead",
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
      isDeprecated: false,
      deprecationReason: null,
    };
    // Should only show non-deprecated argument
    expect(formatField(field)).toBe("    product(id: ID): Product");
  });

  test("handles field with newlines in description", () => {
    const field = {
      name: "content",
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
      description: "The content of\nthe field with\nmultiple lines",
      isDeprecated: false,
      deprecationReason: null,
    };
    const result = formatField(field);
    expect(result).toBe(
      "    content: String\n      # The content of the field with multiple lines",
    );
    // Should replace newlines with spaces
    expect(result).not.toContain("\n#");
  });
});

describe("formatSchemaType", () => {
  test("formats object type with fields and filters out deprecated ones", () => {
    const type = {
      kind: "OBJECT",
      name: "Product",
      description: "A product in the shop",
      interfaces: [{ name: "Node" }],
      fields: [
        {
          name: "id",
          args: [],
          type: { kind: "SCALAR", name: "ID", ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "title",
          args: [],
          type: { kind: "SCALAR", name: "String", ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "legacyTitle",
          args: [],
          type: { kind: "SCALAR", name: "String", ofType: null },
          isDeprecated: true,
          deprecationReason: "Use title instead",
        },
      ],
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain("OBJECT Product");
    expect(result).toContain("Description: A product in the shop");
    expect(result).toContain("Implements: Node");
    expect(result).toContain("Fields:");
    expect(result).toContain("id: ID");
    expect(result).toContain("title: String");
    // Should NOT contain deprecated field
    expect(result).not.toContain("legacyTitle");
  });

  test("formats object type with field descriptions", () => {
    const type = {
      kind: "OBJECT",
      name: "Product",
      description: "A product in the shop",
      interfaces: [],
      fields: [
        {
          name: "id",
          args: [],
          type: { kind: "SCALAR", name: "ID", ofType: null },
          description: "The unique identifier",
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "title",
          args: [],
          type: { kind: "SCALAR", name: "String", ofType: null },
          description: "The product title",
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain("OBJECT Product");
    expect(result).toContain("Fields:");
    expect(result).toContain("    id: ID\n      # The unique identifier");
    expect(result).toContain("    title: String\n      # The product title");
  });

  test("formats input object type with input fields", () => {
    const type = {
      kind: "INPUT_OBJECT",
      name: "ProductInput",
      description: "Input for creating a product",
      interfaces: [],
      fields: null,
      inputFields: [
        {
          name: "title",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
        },
        {
          name: "price",
          type: { kind: "SCALAR", name: "Float", ofType: null },
          defaultValue: null,
        },
      ],
    };

    const result = formatSchemaType(type);
    expect(result).toContain("INPUT_OBJECT ProductInput");
    expect(result).toContain("Description: Input for creating a product");
    expect(result).toContain("Input Fields:");
    expect(result).toContain("title: String");
    expect(result).toContain("price: Float");
  });

  test("formats input object type with input field descriptions", () => {
    const type = {
      kind: "INPUT_OBJECT",
      name: "ProductInput",
      description: "Input for creating a product",
      interfaces: [],
      fields: null,
      inputFields: [
        {
          name: "title",
          type: { kind: "SCALAR", name: "String", ofType: null },
          description: "The title of the product",
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "price",
          type: { kind: "SCALAR", name: "Float", ofType: null },
          description: "The price in the shop's currency",
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
    };

    const result = formatSchemaType(type);
    expect(result).toContain("INPUT_OBJECT ProductInput");
    expect(result).toContain("Input Fields:");
    expect(result).toContain(
      "    title: String\n      # The title of the product",
    );
    expect(result).toContain(
      "    price: Float\n      # The price in the shop's currency",
    );
  });

  test("filters out deprecated input fields in INPUT_OBJECT types", () => {
    const type = {
      kind: "INPUT_OBJECT",
      name: "ProductInput",
      description: "Input for creating a product",
      interfaces: [],
      fields: null,
      inputFields: [
        {
          name: "title",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "legacyTitle",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: true,
          deprecationReason: "Use title instead",
        },
        {
          name: "price",
          type: { kind: "SCALAR", name: "Float", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
    };

    const result = formatSchemaType(type);
    expect(result).toContain("INPUT_OBJECT ProductInput");
    expect(result).toContain("Input Fields:");
    expect(result).toContain("title: String");
    expect(result).toContain("price: Float");
    // Should NOT contain deprecated input field
    expect(result).not.toContain("legacyTitle");
  });

  test("handles object with fields containing deprecated nested arguments", () => {
    const type = {
      kind: "OBJECT",
      name: "Product",
      description: "A product",
      interfaces: [],
      fields: [
        {
          name: "variants",
          args: [
            {
              name: "first",
              type: { kind: "SCALAR", name: "Int", ofType: null },
              defaultValue: null,
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: "oldLimit",
              type: { kind: "SCALAR", name: "Int", ofType: null },
              defaultValue: null,
              isDeprecated: true,
              deprecationReason: "Use first instead",
            },
            {
              name: "filter",
              type: {
                kind: "INPUT_OBJECT",
                name: "VariantFilter",
                ofType: null,
              },
              defaultValue: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
          type: { kind: "OBJECT", name: "VariantConnection", ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain("OBJECT Product");
    expect(result).toContain("Fields:");
    expect(result).toContain(
      "variants(first: Int, filter: VariantFilter): VariantConnection",
    );
    // Should NOT contain deprecated argument
    expect(result).not.toContain("oldLimit");
  });

  test("handles type with many fields by truncating", () => {
    // Create an object with more than MAX_FIELDS_TO_SHOW fields
    const manyFields = Array(MAX_FIELDS_TO_SHOW + 10)
      .fill(null)
      .map((_, i) => ({
        name: `field${i}`,
        args: [],
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: false,
        deprecationReason: null,
      }));

    const type = {
      kind: "OBJECT",
      name: "LargeType",
      description: "Type with many fields",
      interfaces: [],
      fields: manyFields,
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain(`... and 10 more fields`);
    // Should include MAX_FIELDS_TO_SHOW fields
    expect((result.match(/field\d+: String/g) || []).length).toBe(
      MAX_FIELDS_TO_SHOW,
    );
  });

  test("handles type with many input fields by truncating", () => {
    // Create an input object with more than MAX_FIELDS_TO_SHOW fields
    const manyInputFields = Array(MAX_FIELDS_TO_SHOW + 10)
      .fill(null)
      .map((_, i) => ({
        name: `inputField${i}`,
        type: { kind: "SCALAR", name: "String", ofType: null },
        defaultValue: null,
      }));

    const type = {
      kind: "INPUT_OBJECT",
      name: "LargeInputType",
      description: "Input type with many fields",
      interfaces: [],
      fields: null,
      inputFields: manyInputFields,
    };

    const result = formatSchemaType(type);
    expect(result).toContain(`... and 10 more input fields`);
    // Should include MAX_FIELDS_TO_SHOW fields
    expect((result.match(/inputField\d+: String/g) || []).length).toBe(
      MAX_FIELDS_TO_SHOW,
    );
  });
});

describe("formatGraphqlOperation", () => {
  test("formats query with arguments and filters out deprecated ones", () => {
    const query = {
      name: "product",
      description: "Get a product by ID",
      args: [
        {
          name: "id",
          type: {
            kind: "NON_NULL",
            name: null,
            ofType: { kind: "SCALAR", name: "ID", ofType: null },
          },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "legacyId",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: true,
          deprecationReason: "Use id instead",
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
    };

    const result = formatGraphqlOperation(
      query,
      "QueryRoot",
      mockOfflineScopes,
    );
    expect(result).toContain("product");
    expect(result).toContain("Description: Get a product by ID");
    expect(result).toContain("Arguments:");
    expect(result).toContain("id: ID!");
    // Should NOT contain deprecated argument
    expect(result).not.toContain("legacyId");
    expect(result).toContain("Returns: Product");
  });

  test("truncates long descriptions", () => {
    const longDescription =
      "This is a very long description that should be truncated. ".repeat(10);
    const query = {
      name: "longQuery",
      description: longDescription,
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
    };

    // Without truncation manager, descriptions are not truncated
    const result = formatGraphqlOperation(
      query,
      "QueryRoot",
      mockOfflineScopes,
    );
    expect(result).toContain("Description:");
    expect(result).toContain(longDescription);
    // Full description should be shown when no truncation manager is provided
  });

  test("handles complex nested deprecated arguments in mutations", () => {
    const mutation = {
      name: "productUpdate",
      description: "Update a product",
      args: [
        {
          name: "id",
          type: {
            kind: "NON_NULL",
            name: null,
            ofType: { kind: "SCALAR", name: "ID", ofType: null },
          },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "input",
          type: {
            kind: "NON_NULL",
            name: null,
            ofType: {
              kind: "INPUT_OBJECT",
              name: "ProductInput",
              ofType: null,
            },
          },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "legacyInput",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: true,
          deprecationReason: "Use input parameter instead",
        },
        {
          name: "oldId",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
          isDeprecated: false,
          deprecationReason: "Use id parameter instead", // Has deprecationReason
        },
      ],
      type: { kind: "OBJECT", name: "ProductUpdatePayload", ofType: null },
    };

    const result = formatGraphqlOperation(
      mutation,
      "Mutation",
      mockOfflineScopes,
    );
    expect(result).toContain("productUpdate");
    expect(result).toContain("id: ID!");
    expect(result).toContain("input: ProductInput!");
    // Should NOT contain deprecated arguments
    expect(result).not.toContain("legacyInput");
    expect(result).not.toContain("oldId");
  });
});

describe("filterAndSortItems", () => {
  test("filters items by name matching search term", () => {
    const items = [
      { name: "Product" },
      { name: "ProductInput" },
      { name: "Order" },
      { name: "OrderInput" },
      { name: "ProductVariant" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items.length).toBe(3);
    expect(result.items[0].name).toBe("Product");
    expect(result.items[1].name).toBe("ProductInput");
    expect(result.items[2].name).toBe("ProductVariant");
    expect(result.wasTruncated).toBe(false);
  });

  test("sorts items by name length", () => {
    const items = [
      { name: "ProductVariant" },
      { name: "ProductInput" },
      { name: "Product" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items[0].name).toBe("Product"); // Shortest first
    expect(result.items[1].name).toBe("ProductInput");
    expect(result.items[2].name).toBe("ProductVariant");
  });

  test("truncates results to maxItems", () => {
    const items = Array(20)
      .fill(null)
      .map((_, i) => ({ name: `Product${i}` }));

    const result = filterAndSortItems(items, "product", 5);
    expect(result.items.length).toBe(5);
    expect(result.wasTruncated).toBe(true);
  });

  test("handles items without names", () => {
    const items = [
      { name: "Product" },
      { somethingElse: true },
      { name: null },
      { name: "AnotherProduct" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items.length).toBe(2);
  });
});

describe("introspectGraphqlSchema", () => {
  let realSchemas: APIVersionWithAPI[] = [];
  let latestVersion: string = "";

  // Use bundled schemas for tests
  beforeAll(() => {
    realSchemas = loadAPISchemas(getApiIdsByCategory(APICategory.GRAPHQL));
    // We expect at least one schema to be loaded
    if (realSchemas.length === 0) {
      throw new Error("No schemas loaded for testing");
    }
    const latestStableSchema =
      realSchemas.find(
        (schema) => schema.api === "admin" && schema.latestVersion,
      ) ??
      realSchemas.find((schema) => schema.latestVersion) ??
      realSchemas[0];
    latestVersion = latestStableSchema.name;
  });

  it("defaults to latest stable schema when no version is provided", async () => {
    const adminSchemas = loadAPISchemas(["admin"]);

    const latestStableAdminSchema = adminSchemas.find(
      (schema) => schema.latestVersion,
    );
    if (!latestStableAdminSchema) {
      throw new Error("No latest stable admin schema found for testing");
    }

    const [defaultResult, latestStableResult] = await Promise.all([
      introspectGraphqlSchema("product", "admin", { filter: ["all"] }),
      introspectGraphqlSchema("product", "admin", {
        schemaOptions: latestStableAdminSchema,
        filter: ["all"],
      }),
    ]);

    expect(defaultResult).toEqual(latestStableResult);
  });

  it("returns structured results for a search query", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      // No filter provided - should return all sections
    });

    // Check structure
    expect(result.types).toBeDefined();
    expect(Array.isArray(result.types)).toBe(true);
    expect(result.types.length).toBeGreaterThan(0);
    expect(typeof result.typesWereTruncated).toBe("boolean");

    expect(result.queries).toBeDefined();
    expect(Array.isArray(result.queries)).toBe(true);
    expect(typeof result.queriesWereTruncated).toBe("boolean");

    expect(result.mutations).toBeDefined();
    expect(Array.isArray(result.mutations)).toBe(true);
    expect(typeof result.mutationsWereTruncated).toBe("boolean");

    // Check that Product type is in results
    const productType = result.types.find((t) => t.name === "Product");
    expect(productType).toBeDefined();
    expect(productType?.details).toContain("OBJECT Product");

    // Check that product query is in results
    const productQuery = result.queries.find((q) => q.name === "product");
    expect(productQuery).toBeDefined();

    // Check that productCreate mutation is in results
    const productCreateMutation = result.mutations.find(
      (m) => m.name === "productCreate",
    );
    expect(productCreateMutation).toBeDefined();
  });

  it("returns results with scope information when available", async () => {
    const result = await introspectGraphqlSchema("productCreate", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["mutations"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Find productCreate mutation
    const productCreateMutation = result.mutations.find(
      (m) => m.name === "productCreate",
    );
    expect(productCreateMutation).toBeDefined();

    // Check that it has scope information
    expect(productCreateMutation?.scopes).toBeDefined();
    expect(Array.isArray(productCreateMutation?.scopes)).toBe(true);
    expect(productCreateMutation?.scopes).toContain("write_products");
  });

  it("returns scope information for queries", async () => {
    // Test with products query
    const result1 = await introspectGraphqlSchema("products", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["queries"],
    });

    // Check that result has expected structure
    expect(result1.types).toBeDefined();
    expect(result1.queries).toBeDefined();
    expect(result1.mutations).toBeDefined();

    // products query now inherits scopes from Product type
    const productsQuery = result1.queries.find((q) => q.name === "products");
    expect(productsQuery).toBeDefined();
    if (productsQuery) {
      // Should now show scope information inherited from Product type
      expect(productsQuery.scopes).toBeDefined();
      expect(Array.isArray(productsQuery.scopes)).toBe(true);
      expect(productsQuery.scopes).toContain("read_products");
    }
  });

  it("inherits scope information from return types when field has no explicit scopes", async () => {
    // Test 'product' query which returns Product type
    const productResult = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["queries"],
    });

    // Check that result has expected structure
    expect(productResult.types).toBeDefined();
    expect(productResult.queries).toBeDefined();
    expect(productResult.mutations).toBeDefined();

    const productQuery = productResult.queries.find(
      (q) => q.name === "product",
    );
    expect(productQuery).toBeDefined();
    // Should inherit read_products from Product type
    expect(productQuery?.scopes).toContain("read_products");

    // Test 'products' query which returns ProductConnection
    const productsResult = await introspectGraphqlSchema("products", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["queries"],
    });

    // Check that result has expected structure
    expect(productsResult.types).toBeDefined();
    expect(productsResult.queries).toBeDefined();
    expect(productsResult.mutations).toBeDefined();

    const productsQuery = productsResult.queries.find(
      (q) => q.name === "products",
    );
    expect(productsQuery).toBeDefined();
    // Should inherit read_products from Product (extracted from ProductConnection)
    expect(productsQuery?.scopes).toContain("read_products");
  });

  it("includes scope information in mutations", async () => {
    const result = await introspectGraphqlSchema("productCreate", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["mutations"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Check for productCreate mutation
    const productCreateMutation = result.mutations.find(
      (m) => m.name === "productCreate",
    );
    expect(productCreateMutation).toBeDefined();

    // Check for scope information in mutations
    expect(productCreateMutation?.scopes).toBeDefined();
    expect(productCreateMutation?.scopes).toContain("write_products");
  });

  it("normalizes query by removing trailing s", async () => {
    const pluralResult = await introspectGraphqlSchema("products", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
    });
    const singularResult = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
    });

    // "products" should normalize to "product" and return the same results
    expect(pluralResult.types).toEqual(singularResult.types);
    expect(pluralResult.queries).toEqual(singularResult.queries);
    expect(pluralResult.mutations).toEqual(singularResult.mutations);
  });

  it("normalizes query by removing spaces", async () => {
    const spacedResult = await introspectGraphqlSchema(
      "product input",
      "admin",
      {
        schemaOptions: {
          name: latestVersion,
          latestVersion: realSchemas[0].latestVersion,
        },
      },
    );
    const noSpaceResult = await introspectGraphqlSchema(
      "productinput",
      "admin",
      {
        schemaOptions: {
          name: latestVersion,
          latestVersion: realSchemas[0].latestVersion,
        },
      },
    );

    // "product input" should normalize to "productinput" and return the same results
    expect(spacedResult.types).toEqual(noSpaceResult.types);
    expect(spacedResult.queries).toEqual(noSpaceResult.queries);
    expect(spacedResult.mutations).toEqual(noSpaceResult.mutations);
  });

  it("filters results to show only types", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["types"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Filter should not affect the data structure, just what is shown in formatting
    // All arrays should still be populated with matching items
    expect(result.types.length).toBeGreaterThan(0);
    const productType = result.types.find((t) => t.name === "Product");
    expect(productType).toBeDefined();
    expect(productType?.details).toContain("OBJECT Product");
  });

  it("filters results to show only queries", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["queries"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Filter should not affect the data structure
    expect(result.queries.length).toBeGreaterThan(0);
    const productQuery = result.queries.find((q) => q.name === "product");
    expect(productQuery).toBeDefined();
  });

  it("filters results to show only mutations", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["mutations"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Filter should not affect the data structure
    expect(result.mutations.length).toBeGreaterThan(0);
    const productCreateMutation = result.mutations.find(
      (m) => m.name === "productCreate",
    );
    expect(productCreateMutation).toBeDefined();
  });

  it("shows all sections when filter is 'all'", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["all"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // All sections should have results
    expect(result.types.length).toBeGreaterThan(0);
    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.mutations.length).toBeGreaterThan(0);

    // Check that scopes are included where relevant
    const mutationWithScopes = result.mutations.find(
      (m) => m.scopes.length > 0,
    );
    expect(mutationWithScopes).toBeDefined();
  });

  it("can show multiple sections with array of filters", async () => {
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
      filter: ["queries", "mutations"],
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // Filter affects what data is returned
    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.mutations.length).toBeGreaterThan(0);
    // Types should be empty when not included in filter
    expect(result.types.length).toBe(0);
  });

  it("defaults to showing all sections when filter is not provided", async () => {
    // When not providing filter, it should default to ["all"]
    const result = await introspectGraphqlSchema("product", "admin", {
      schemaOptions: {
        name: latestVersion,
        latestVersion: realSchemas[0].latestVersion,
      },
    });

    // Check that result has expected structure
    expect(result.types).toBeDefined();
    expect(result.queries).toBeDefined();
    expect(result.mutations).toBeDefined();

    // All sections should have results when no filter is provided
    expect(result.types.length).toBeGreaterThan(0);
    expect(result.queries.length).toBeGreaterThan(0);
    expect(result.mutations.length).toBeGreaterThan(0);
  });
});

describe("scope formatting functions", () => {
  test("formatScopes formats scope information", () => {
    const scopes = ["write_products", "manage_products"];
    const formatted = formatScopes(scopes);
    expect(formatted).toBe(
      "\nRequired scopes: write_products, manage_products",
    );
  });

  test("formatScopes returns empty string for empty scopes", () => {
    expect(formatScopes([])).toBe("");
  });

  test("formatScopes returns empty string for undefined scopes", () => {
    expect(formatScopes(undefined as any)).toBe("");
    expect(formatScopes(null as any)).toBe("");
  });
});

describe("SmartTruncationManager", () => {
  test("should not truncate descriptions when under token limit", () => {
    const manager = new SmartTruncationManager();

    // Add a small amount of structural tokens
    manager.addStructuralTokens(100);

    // Register a few short descriptions
    manager.registerDescription("desc1", "This is a short description");
    manager.registerDescription("desc2", "Another brief description here");
    manager.registerDescription("desc3", "A third concise description");

    // Apply truncation (should do nothing as we're under limit)
    manager.applySmartTruncation();

    // All descriptions should remain unchanged
    expect(manager.getDescription("desc1")).toBe("This is a short description");
    expect(manager.getDescription("desc2")).toBe(
      "Another brief description here",
    );
    expect(manager.getDescription("desc3")).toBe("A third concise description");
    expect(manager.hadTruncation()).toBe(false);
  });

  test("should apply proportional truncation when over token limit", () => {
    const manager = new SmartTruncationManager();

    // Add structural tokens that will push us over the limit
    // addStructuralTokens takes characters, so 4800 chars = 1200 tokens
    // We need ~4800 tokens total, so we need ~19200 chars of structure
    manager.addStructuralTokens(19200); // ~4800 tokens (19200 chars / 4)

    // Create a very long description (600 chars - should be reduced to ~30%)
    const veryLongDesc = "x".repeat(600);
    // Create a long description (400 chars - should be reduced to ~50%)
    const longDesc = "y".repeat(400);
    // Create a medium description (200 chars - should be reduced to ~70%)
    const mediumDesc = "z".repeat(200);
    // Create a short description (100 chars - should remain intact initially)
    const shortDesc = "a".repeat(100);

    manager.registerDescription("veryLong", veryLongDesc);
    manager.registerDescription("long", longDesc);
    manager.registerDescription("medium", mediumDesc);
    manager.registerDescription("short", shortDesc);

    // Apply truncation
    manager.applySmartTruncation();

    // Check that truncation occurred
    expect(manager.hadTruncation()).toBe(true);

    // Very long description should be reduced to ~30% (180 chars)
    const veryLongResult = manager.getDescription("veryLong");
    expect(veryLongResult.endsWith("...")).toBe(true);
    expect(veryLongResult.length).toBeLessThanOrEqual(183); // 180 + "..."
    expect(veryLongResult.length).toBeGreaterThanOrEqual(
      MIN_DESCRIPTION_LENGTH,
    );

    // Long description should be reduced to ~50% (200 chars)
    const longResult = manager.getDescription("long");
    expect(longResult.endsWith("...")).toBe(true);
    expect(longResult.length).toBeLessThanOrEqual(203); // 200 + "..."

    // Medium description might not be truncated if we break early after saving enough
    // (we save 420 + 200 = 620 chars from veryLong and long, which exceeds the 500 needed)
    const mediumResult = manager.getDescription("medium");
    // Should be either unchanged (if we broke early) or truncated
    if (mediumResult.endsWith("...")) {
      expect(mediumResult.length).toBeLessThanOrEqual(143); // 140 + "..."
    } else {
      expect(mediumResult).toBe(mediumDesc);
    }

    // Short description might be truncated if needed to fit
    const shortResult = manager.getDescription("short");
    // Should be either unchanged or truncated but not below minimum
    if (shortResult.endsWith("...")) {
      expect(shortResult.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH);
    } else {
      expect(shortResult).toBe(shortDesc);
    }
  });

  test("should preserve minimum description length", () => {
    const manager = new SmartTruncationManager();

    // Force extreme truncation scenario
    // addStructuralTokens takes characters, so we need ~19600 chars = ~4900 tokens
    manager.addStructuralTokens(19600); // ~4900 tokens (19600 chars / 4)

    // Add several long descriptions
    for (let i = 0; i < 10; i++) {
      manager.registerDescription(`desc${i}`, "x".repeat(500));
    }

    manager.applySmartTruncation();

    // Every description should be at least MIN_DESCRIPTION_LENGTH
    for (let i = 0; i < 10; i++) {
      const desc = manager.getDescription(`desc${i}`);
      expect(desc.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH);
    }
  });

  test("should handle empty descriptions gracefully", () => {
    const manager = new SmartTruncationManager();

    manager.registerDescription("empty", "");
    manager.registerDescription("whitespace", "   ");
    manager.registerDescription("normal", "Normal description");

    manager.applySmartTruncation();

    expect(manager.getDescription("empty")).toBe("");
    expect(manager.getDescription("whitespace")).toBe("");
    expect(manager.getDescription("normal")).toBe("Normal description");
  });

  test("should clean multiline descriptions", () => {
    const manager = new SmartTruncationManager();

    const multilineDesc = "This is\na multiline\ndescription\nwith breaks";
    manager.registerDescription("multiline", multilineDesc);

    manager.applySmartTruncation();

    // Newlines should be replaced with spaces
    const result = manager.getDescription("multiline");
    expect(result).toBe("This is a multiline description with breaks");
    expect(result.includes("\n")).toBe(false);
  });

  test("should apply progressive reduction when initial truncation insufficient", () => {
    const manager = new SmartTruncationManager();

    // Create a scenario where initial truncation isn't enough
    // addStructuralTokens takes characters, so we need enough to push over limit
    // 5x 1000 char descriptions = ~1250 tokens
    // We need total significantly > 5000 to force truncation of all descriptions
    // Let's aim for ~6000 total tokens, so structure should be ~4750 tokens = ~19000 chars
    manager.addStructuralTokens(19000); // ~4750 tokens (19000 chars / 4)

    // Add multiple very long descriptions
    const veryLongDesc = "x".repeat(1000);
    for (let i = 0; i < 5; i++) {
      manager.registerDescription(`long${i}`, veryLongDesc);
    }

    manager.applySmartTruncation();

    // All descriptions should be truncated
    expect(manager.hadTruncation()).toBe(true);

    // Check that all are truncated significantly
    for (let i = 0; i < 5; i++) {
      const desc = manager.getDescription(`long${i}`);
      expect(desc.endsWith("...")).toBe(true);
      // Should be much shorter than original
      expect(desc.length).toBeLessThan(500);
      // But not below minimum
      expect(desc.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH);
    }
  });

  test("placeholder replacement system works correctly", () => {
    const manager = new SmartTruncationManager();

    // Register some descriptions
    manager.registerDescription("field1_desc", "Description for field 1");
    manager.registerDescription("field2_desc", "Description for field 2");
    manager.registerDescription("type_desc", "Type description here");

    manager.applySmartTruncation();

    // Create text with placeholders
    const textWithPlaceholders = `
      Field 1: {{field1_desc}}
      Field 2: {{field2_desc}}
      Type: {{type_desc}}
      Unknown: {{unknown_desc}}
    `;

    // Replace placeholders manually (simulating what the main function does)
    const replaced = textWithPlaceholders.replace(
      /\{\{([^}]+)\}\}/g,
      (match, descId) => {
        const description = manager.getDescription(descId);
        // Only replace if description exists (non-empty), otherwise keep placeholder
        return description || match;
      },
    );

    expect(replaced).toContain("Description for field 1");
    expect(replaced).toContain("Description for field 2");
    expect(replaced).toContain("Type description here");
    expect(replaced).toContain("{{unknown_desc}}"); // Unknown placeholder unchanged
  });
});

describe("formatField with SmartTruncationManager", () => {
  test("should use truncation manager when provided", () => {
    const manager = new SmartTruncationManager();

    const field = {
      name: "productTitle",
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
      description:
        "The title of the product that will be displayed to customers",
    };

    const result = formatField(field, manager, "test_type");

    // Should contain placeholder instead of actual description
    expect(result).toContain("{{test_type_field_productTitle}}");
    expect(result).not.toContain("The title of the product");

    // Manager should have registered the description
    manager.applySmartTruncation();
    expect(manager.getDescription("test_type_field_productTitle")).toBe(
      "The title of the product that will be displayed to customers",
    );
  });

  test("should fall back to inline description when no manager", () => {
    const field = {
      name: "productTitle",
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
      description: "The title of the product",
    };

    const result = formatField(field);

    // Should contain actual description, not placeholder
    expect(result).toContain("      # The title of the product");
    expect(result).not.toContain("{{");
  });
});

describe("formatSchemaType with SmartTruncationManager", () => {
  test("should use truncation manager for type descriptions", () => {
    const manager = new SmartTruncationManager();

    const type = {
      kind: "OBJECT",
      name: "Product",
      description:
        "Represents a product in the store catalog with all its variants and details",
      fields: [],
      interfaces: [],
    };

    const result = formatSchemaType(type, manager);

    // Should contain placeholder for description
    expect(result).toContain("{{type_Product_desc}}");
    expect(result).not.toContain("Represents a product");

    // Manager should have registered the description
    manager.applySmartTruncation();
    expect(manager.getDescription("type_Product_desc")).toBe(
      "Represents a product in the store catalog with all its variants and details",
    );
  });

  test("should handle types with fields and truncation manager", () => {
    const manager = new SmartTruncationManager();

    const type = {
      kind: "OBJECT",
      name: "Product",
      description: "Product type",
      fields: [
        {
          name: "id",
          type: { kind: "SCALAR", name: "ID", ofType: null },
          description: "Unique identifier for the product",
          args: [],
          isDeprecated: false,
        },
        {
          name: "title",
          type: { kind: "SCALAR", name: "String", ofType: null },
          description: "Product title displayed to customers",
          args: [],
          isDeprecated: false,
        },
      ],
      interfaces: [],
    };

    const result = formatSchemaType(type, manager);

    // Should contain placeholders for all descriptions
    expect(result).toContain("{{type_Product_desc}}");
    expect(result).toContain("{{type_Product_field_id}}");
    expect(result).toContain("{{type_Product_field_title}}");

    // Verify all descriptions are registered
    manager.applySmartTruncation();
    expect(manager.getDescription("type_Product_desc")).toBe("Product type");
    expect(manager.getDescription("type_Product_field_id")).toBe(
      "Unique identifier for the product",
    );
    expect(manager.getDescription("type_Product_field_title")).toBe(
      "Product title displayed to customers",
    );
  });
});
