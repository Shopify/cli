import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APICategory,
  getApiIdsByCategory,
  ShopifyAPIs,
  ValidationResult,
} from "../types/index.js";
import { validateGraphQLOperation } from "./index.js";

// Import the module to mock
import {
  APIVersionWithAPI,
  loadAPISchemas,
} from "../schemaOperations/index.js";
import * as offlineScopes from "../schemaOperations/offlineScopes.js";
import {
  INTERNAL_API_IDS,
  SHOPIFY_APIS as INTERNAL_SHOPIFY_APIS,
} from "../internal/index.js";

// Mock the module
vi.mock("../schemaOperations/offlineScopes.js", () => ({
  analyzeRequiredOfflineScopes: vi.fn(),
  formatScopes: vi.fn((scopes) => {
    if (!scopes || scopes.length === 0) return "";
    return `\nRequired scopes: ${scopes.join(", ")}`;
  }),
}));

// Real schemas for testing
let realSchemas: APIVersionWithAPI[] = [];
let latestVersion: string = "";

beforeAll(() => {
  realSchemas = loadAPISchemas(getApiIdsByCategory(APICategory.GRAPHQL));
  // We expect at least one schema to be loaded
  if (realSchemas.length === 0) {
    throw new Error("No schemas loaded for testing");
  }
  latestVersion = realSchemas[0].name;
});

describe("validateGraphQLOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("schema name validation", () => {
    it("should throw error for unsupported api names", async () => {
      await expect(
        validateGraphQLOperation(
          "query { products { id } }",
          "unsupported-api" as ShopifyAPIs,
        ),
      ).rejects.toThrow(
        'No schema configuration found for API "unsupported-api"',
      );
    });

    it("should accept admin api name", async () => {
      // This test will use the real schema and proceed to validation
      const result = await validateGraphQLOperation(
        "query { nonExistentField }",
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      // Should proceed past schema name validation but may fail on field validation
      expect(result.validation.resultDetail).not.toContain(
        "Unsupported schema",
      );
      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");
    });

    it("should validate against specific version", async () => {
      // Use real schemas instead of creating fake ones
      const result = await validateGraphQLOperation(
        "query { products(first: 10) { edges { node { id title } } } }",
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      // Should succeed as this is a valid query
      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
    });

    it("should throw error for unsupported version listing available versions", async () => {
      await expect(
        validateGraphQLOperation("query { products { id } }", "admin", {
          api: "admin",
          name: "2020-01",
          schemaPath: "/nonexistent/admin_2020-01.json",
          latestVersion: false,
        }),
      ).rejects.toThrow(
        /Unsupported version "2020-01" for API "admin"\. Available versions: .+/,
      );
    });

    it("should accept Functions API with unstable version", async () => {
      // This is the regression test for the original issue
      const functionsAPI = "functions_local_pickup_delivery_option_generator";
      const schemas = loadAPISchemas([functionsAPI]);

      const result = await validateGraphQLOperation(
        `query Input {
          cart { lines { id } }
          locations { handle }
        }`,
        functionsAPI,
        schemas[0],
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
    });

    it("should not write debug logs when patching Functions schemas", async () => {
      const consoleDebug = vi
        .spyOn(console, "debug")
        .mockImplementation(() => undefined);

      try {
        const functionsAPI = "functions_delivery_customization";
        const schemas = loadAPISchemas([functionsAPI]);

        const result = await validateGraphQLOperation(
          `query Input {
            cart {
              deliveryGroups {
                deliveryOptions {
                  handle
                  title
                }
              }
            }
          }`,
          functionsAPI,
          schemas[0],
        );

        expect(result.validation.result).toBe(ValidationResult.SUCCESS);
        expect(consoleDebug).not.toHaveBeenCalled();
      } finally {
        consoleDebug.mockRestore();
      }
    });
  });

  describe("GraphQL operation processing", () => {
    it("should fail for empty code", async () => {
      const result = await validateGraphQLOperation("", "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toBe(
        "No GraphQL operation found in the provided code.",
      );
    });

    it("should fail for code with only whitespace", async () => {
      const result = await validateGraphQLOperation("   \n  \n", "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toBe(
        "No GraphQL operation found in the provided code.",
      );
    });

    it("should process valid GraphQL code", async () => {
      const result = await validateGraphQLOperation(
        "query { nonExistentField }",
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      // Should proceed past processing (GraphQL was found and processed)
      // May succeed or fail based on schema validation, but won't fail due to missing GraphQL
      expect(result.validation.resultDetail).not.toBe(
        "No GraphQL operation found in the provided code.",
      );
      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");
    });

    it("should handle GraphQL with extra whitespace", async () => {
      const result = await validateGraphQLOperation(
        "  \n  query { nonExistentField }  \n  ",
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      // Should proceed past processing (GraphQL was found and processed)
      expect(result.validation.resultDetail).not.toBe(
        "No GraphQL operation found in the provided code.",
      );
      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");
    });
  });

  describe("GraphQL parsing", () => {
    it("should detect GraphQL syntax errors", async () => {
      const invalidGraphQL =
        "query {\n  products {\n    id\n  // Missing closing brace";

      const result = await validateGraphQLOperation(invalidGraphQL, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain("GraphQL syntax error:");
    });

    it("should handle malformed query structures", async () => {
      const malformedGraphQL = "query { { { invalid } } }";

      const result = await validateGraphQLOperation(malformedGraphQL, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain("GraphQL syntax error:");
    });

    it("should parse valid GraphQL syntax", async () => {
      const validSyntax = "query { nonExistentField }";

      const result = await validateGraphQLOperation(validSyntax, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      // Should proceed past parsing (may succeed or fail based on schema validation)
      expect(result.validation.resultDetail).not.toContain(
        "GraphQL syntax error:",
      );
      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");
    });
  });

  describe("GraphQL schema validation", () => {
    it("should fail for operations with non-existent fields", async () => {
      const queryWithInvalidField = "query { nonExistentField }";

      const result = await validateGraphQLOperation(
        queryWithInvalidField,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");

      // Should fail for schema validation errors (non-existent fields)
      if (result.validation.result === ValidationResult.FAILED) {
        expect(result.validation.resultDetail).not.toContain(
          "GraphQL syntax error:",
        );
        expect(result.validation.resultDetail).not.toContain(
          "Unsupported schema",
        );
      }
    });

    it("should succeed for valid GraphQL operations", async () => {
      const validQuery = `
        query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(validQuery, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.validation.resultDetail).toContain("against schema");
      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
    });

    it("should succeed for valid mutations", async () => {
      const mutation = `
        mutation {
          productCreate(product: {title: "Test Product"}) {
            product {
              id
              title
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(mutation, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.validation.resultDetail).toContain("against schema");
      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
    });

    it("should fail for non-existent mutations", async () => {
      const invalidMutation = `
        mutation {
          nonExistentMutation(input: {title: "Test"}) {
            result {
              id
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(invalidMutation, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toBeDefined();
      expect(typeof result.validation.resultDetail).toBe("string");

      // Should fail for either GraphQL validation errors OR schema conversion errors
      expect(result.validation.resultDetail).not.toContain(
        "GraphQL syntax error:",
      );
      expect(result.validation.resultDetail).not.toContain(
        "Unsupported schema",
      );

      // The error could be either:
      // 1. "GraphQL validation errors:" for actual field validation
      // 2. "Validation error:" for schema conversion issues
      const hasValidationError =
        result.validation.resultDetail.includes("GraphQL validation errors:") ||
        result.validation.resultDetail.includes("Validation error:");
      expect(hasValidationError).toBe(true);
    });
  });

  describe("real-world scenarios", () => {
    it("should validate the original problem query successfully", async () => {
      const validQuery = `
        query MostRecentProducts {
          products(first: 10, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                createdAt
              }
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(validQuery, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.validation.resultDetail).toContain("against schema");
    });
  });

  describe("offline scope validation", () => {
    it("should include offline scopes in successful validation", async () => {
      const mockScopes = ["read_products", "write_products"];
      vi.mocked(offlineScopes.analyzeRequiredOfflineScopes).mockResolvedValue(
        mockScopes,
      );

      const result = await validateGraphQLOperation(
        `query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }`,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.scopes).toEqual(["read_products", "write_products"]);
      expect(offlineScopes.analyzeRequiredOfflineScopes).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "Document",
          definitions: expect.any(Array),
        }),
        expect.objectContaining({
          items: expect.any(Array), // offline scope data from real schemas
        }),
        "admin",
      );
    });

    it("should not fail validation when offline scope analysis fails", async () => {
      vi.mocked(offlineScopes.analyzeRequiredOfflineScopes).mockRejectedValue(
        new Error(
          "Bug in walk logic: Cannot read property 'value' of undefined",
        ),
      );

      const result = await validateGraphQLOperation(
        `query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }`,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL query against schema.",
      );
      expect(result.scopes).toEqual([]);
    });

    it("should attempt offline scope analysis for any API", async () => {
      const mockScopes = ["read_products"];
      vi.mocked(offlineScopes.analyzeRequiredOfflineScopes).mockResolvedValue(
        mockScopes,
      );

      const result = await validateGraphQLOperation(
        `query {
          products(first: 10) {
            nodes {
              id
              title
            }
          }
        }`,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.scopes).toEqual(["read_products"]);
      expect(offlineScopes.analyzeRequiredOfflineScopes).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "Document",
          definitions: expect.any(Array),
        }),
        expect.objectContaining({
          items: expect.any(Array), // offline scope data from real schemas
        }),
        "admin",
      );
    });

    it("should not include scopes in message when no scopes are required", async () => {
      vi.mocked(offlineScopes.analyzeRequiredOfflineScopes).mockResolvedValue(
        [],
      );

      const result = await validateGraphQLOperation(
        `query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }`,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toBe(
        "Successfully validated GraphQL query against schema.",
      );
      expect(result.scopes).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should handle actual GraphQL validation errors", async () => {
      // Test with an invalid query that should fail GraphQL validation
      const result = await validateGraphQLOperation(
        "query { products { id } }", // This will fail because products connection needs to specify edges
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain(
        "GraphQL validation errors:",
      );
    });

    it("should provide clear error messages for invalid operations", async () => {
      const result = await validateGraphQLOperation(
        "query { nonExistentField }",
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain(
        "GraphQL validation errors:",
      );
      expect(result.validation.resultDetail).toContain("Cannot query field");
    });
  });

  describe("deprecated field handling", () => {
    // Shop.storefrontUrl is deprecated - use `url` instead
    const queryWithDeprecatedField = `
      query {
        shop {
          storefrontUrl
        }
      }
    `;

    const queryWithoutDeprecatedField = `
      query {
        shop {
          url
        }
      }
    `;

    it("should fail validation when deprecated field is used and failOnDeprecated is true (default)", async () => {
      const result = await validateGraphQLOperation(
        queryWithDeprecatedField,
        "admin",
        {
          apiVersion: {
            api: "admin",
            name: latestVersion,
            schemaPath: realSchemas[0].schemaPath,
            latestVersion: realSchemas[0].latestVersion,
          },
          failOnDeprecated: true,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain(
        "Deprecated fields used:",
      );
      expect(result.validation.resultDetail).toContain("storefrontUrl");
    });

    it("should return INFORM when deprecated field is used and failOnDeprecated is false", async () => {
      const result = await validateGraphQLOperation(
        queryWithDeprecatedField,
        "admin",
        {
          apiVersion: {
            api: "admin",
            name: latestVersion,
            schemaPath: realSchemas[0].schemaPath,
            latestVersion: realSchemas[0].latestVersion,
          },
          failOnDeprecated: false,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.INFORM);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.validation.resultDetail).toContain("Note:");
      expect(result.validation.resultDetail).toContain("storefrontUrl");
    });

    it("should succeed when no deprecated fields are used", async () => {
      const result = await validateGraphQLOperation(
        queryWithoutDeprecatedField,
        "admin",
        {
          apiVersion: {
            api: "admin",
            name: latestVersion,
            schemaPath: realSchemas[0].schemaPath,
            latestVersion: realSchemas[0].latestVersion,
          },
          failOnDeprecated: true,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
      expect(result.validation.resultDetail).not.toContain("Deprecated");
    });

    it("should default failOnDeprecated to true when using new options format", async () => {
      const result = await validateGraphQLOperation(
        queryWithDeprecatedField,
        "admin",
        {
          apiVersion: {
            api: "admin",
            name: latestVersion,
            schemaPath: realSchemas[0].schemaPath,
            latestVersion: realSchemas[0].latestVersion,
          },
          // failOnDeprecated not specified, should default to true
        },
      );

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain(
        "Deprecated fields used:",
      );
    });

    it("should maintain backward compatibility with old APIVersionWithAPI format", async () => {
      // Old format: passing APIVersionWithAPI directly (should default failOnDeprecated to true)
      const result = await validateGraphQLOperation(
        queryWithDeprecatedField,
        "admin",
        {
          api: "admin",
          name: latestVersion,
          schemaPath: realSchemas[0].schemaPath,
          latestVersion: realSchemas[0].latestVersion,
        },
      );

      // Should still work and default to failing on deprecated
      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain(
        "Deprecated fields used:",
      );
    });

    it("should include scopes in INFORM result", async () => {
      const mockScopes = ["read_content"];
      vi.mocked(offlineScopes.analyzeRequiredOfflineScopes).mockResolvedValue(
        mockScopes,
      );

      const result = await validateGraphQLOperation(
        queryWithDeprecatedField,
        "admin",
        {
          apiVersion: {
            api: "admin",
            name: latestVersion,
            schemaPath: realSchemas[0].schemaPath,
            latestVersion: realSchemas[0].latestVersion,
          },
          failOnDeprecated: false,
        },
      );

      expect(result.validation.result).toBe(ValidationResult.INFORM);
      expect(result.scopes).toEqual(["read_content"]);
    });
  });

  describe("options vs defaults", () => {
    it("should use default schema when no options are provided", async () => {
      // Uses the admin schema flagged latestVersion: true in supported-versions-schema.json
      const validQuery = `
        query {
          products(first: 5) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(
        validQuery,
        "admin",
        // No options provided - uses default schema
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
    });

    it("should work when options with both version and schemas are provided", async () => {
      const validQuery = `
        query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `;

      const result = await validateGraphQLOperation(validQuery, "admin", {
        api: "admin",
        name: latestVersion,
        schemaPath: realSchemas[0].schemaPath,
        latestVersion: realSchemas[0].latestVersion,
      });

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
      expect(result.validation.resultDetail).toContain(
        "Successfully validated GraphQL",
      );
    });

    it("should throw error when API has no default schema", async () => {
      await expect(
        validateGraphQLOperation(
          "query { products { id } }",
          "unsupported-api" as ShopifyAPIs,
          // No options provided - will look for default
        ),
      ).rejects.toThrow(
        'No schema configuration found for API "unsupported-api"',
      );
    });
  });

  describe("internal API validation", () => {
    const bourgeoisApiVersion: APIVersionWithAPI = {
      api: INTERNAL_API_IDS.BOURGEOIS as ShopifyAPIs,
      name: "unstable",
      latestVersion: true,
      schemaPath: fileURLToPath(
        new URL(
          `../data/${INTERNAL_SHOPIFY_APIS[INTERNAL_API_IDS.BOURGEOIS].gqlSchemaFileName}`,
          import.meta.url,
        ),
      ),
    };

    it("validates a valid Bourgeois query", async () => {
      const result = await validateGraphQLOperation(
        `query { bankAccounts { isDefault } }`,
        INTERNAL_API_IDS.BOURGEOIS as ShopifyAPIs,
        bourgeoisApiVersion,
      );

      expect(result.validation.result).toBe(ValidationResult.SUCCESS);
    });

    it("rejects a Bourgeois query referencing a non-existent field", async () => {
      const result = await validateGraphQLOperation(
        `query { hallucinated { id } }`,
        INTERNAL_API_IDS.BOURGEOIS as ShopifyAPIs,
        bourgeoisApiVersion,
      );

      expect(result.validation.result).toBe(ValidationResult.FAILED);
      expect(result.validation.resultDetail).toContain("Cannot query field");
    });
  });
});
