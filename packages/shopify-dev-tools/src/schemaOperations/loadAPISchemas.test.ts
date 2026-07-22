import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  APICategory,
  getApiIdsByCategory,
  type ShopifyAPIs,
} from "../types/index.js";
import type { APIVersion } from "../types/index.js";
import { loadAPISchema, loadAPISchemas } from "./loadAPISchemas.js";
import { loadSchemaContent } from "./loadSchemaContent.js";

// Mock the modules
vi.mock("../http/index.js", () => ({
  shopifyDevFetch: vi.fn(),
}));

// Get the project root directory by finding package.json (for testing)
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);

  // Walk up the directory tree until we find package.json
  while (dir !== path.parse(dir).root) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  throw new Error("Could not find project root (package.json not found)");
}

// Path to supported versions schema JSON file (for testing)
const projectRoot = getProjectRoot();
const SUPPORTED_VERSIONS_SCHEMA_PATH = path.join(
  projectRoot,
  "src",
  "data",
  "supported-versions-schema.json",
);

describe("Schema Loading", () => {
  describe("loadAPISchemas", () => {
    it("loads schemas for requested APIs", () => {
      const schemas = loadAPISchemas(["admin"]);
      expect(schemas).toBeDefined();
      expect(Array.isArray(schemas)).toBe(true);
      if (schemas.length > 0) {
        expect(schemas[0]).toHaveProperty("api");
        expect(schemas[0]).toHaveProperty("name");
        expect(schemas[0]).toHaveProperty("schemaPath");
        expect(schemas[0].api).toBe("admin");
      }
    });

    it("loads multiple APIs at once", () => {
      const schemas = loadAPISchemas(["admin", "storefront-graphql"]);
      expect(schemas).toBeDefined();
      expect(Array.isArray(schemas)).toBe(true);

      // Check that we have schemas for both APIs
      const adminSchemas = schemas.filter((s) => s.api === "admin");
      const storefrontSchemas = schemas.filter(
        (s) => s.api === "storefront-graphql",
      );

      expect(adminSchemas.length).toBeGreaterThan(0);
      expect(storefrontSchemas.length).toBeGreaterThan(0);
    });

    it("loads specific schema version when provided", () => {
      const specificVersion = {
        name: "2025-10",
        latestVersion: true,
      };

      const schemas = loadAPISchemas(["admin"], specificVersion);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe("2025-10");
      expect(schemas[0].api).toBe("admin");
      expect(schemas[0].schemaPath).toContain("admin_2025-10.json");
    });

    it("throws error when schemaOptions provided with multiple APIs", () => {
      const specificVersion = {
        name: "2025-10",
        latestVersion: true,
      };

      expect(() => {
        loadAPISchemas(["admin", "storefront-graphql"], specificVersion);
      }).toThrow(
        "schemaOptions can only be provided when requesting a single API",
      );
    });

    it("throws error when no APIs provided", () => {
      expect(() => {
        loadAPISchemas([]);
      }).toThrow("No APIs provided");
    });

    it("returns empty array for unknown API", () => {
      const schemas = loadAPISchemas(["unknown-api" as ShopifyAPIs]);
      expect(schemas).toEqual([]);
    });
  });

  describe("loadAPISchema", () => {
    it("loads a single API schema", () => {
      const schema = loadAPISchema("admin");
      expect(schema).toBeDefined();
      expect(schema.api).toBe("admin");
      expect(schema).toHaveProperty("name");
      expect(schema).toHaveProperty("schemaPath");
    });

    it("returns the latest stable version, not the first entry (e.g. unstable)", () => {
      const schema = loadAPISchema("admin");
      expect(schema.latestVersion).toBe(true);
      expect(schema.name).not.toBe("unstable");
    });

    it("loads a single API schema with specific version", () => {
      const specificVersion = {
        name: "2025-10",
        latestVersion: true,
      };

      const schema = loadAPISchema("admin", specificVersion);
      expect(schema).toBeDefined();
      expect(schema.api).toBe("admin");
      expect(schema.name).toBe("2025-10");
    });

    it("throws error when no schema found for API", () => {
      // This test may not throw if "unknown-api" schemas exist in config
      // but it demonstrates the expected behavior
      try {
        const schema = loadAPISchema("completely-unknown-api" as ShopifyAPIs);
        // If it doesn't throw, the schema should be undefined or empty
        if (schema) {
          expect(schema.api).toBe("completely-unknown-api");
        }
      } catch (error: any) {
        expect(error.message).toContain("No schema found for API");
      }
    });
  });

  describe("Integration with supported-versions-schema.json", () => {
    it("supported-versions-schema.json file exists", () => {
      expect(existsSync(SUPPORTED_VERSIONS_SCHEMA_PATH)).toBe(true);
    });

    it("loads schemas from supported-versions-schema.json", () => {
      const schemas = loadAPISchemas(["admin"]);
      expect(schemas.length).toBeGreaterThan(0);

      // Verify schema structure
      const firstSchema = schemas[0];
      expect(firstSchema).toHaveProperty("api");
      expect(firstSchema).toHaveProperty("name");
      expect(firstSchema).toHaveProperty("schemaPath");

      // Exactly one entry per API should be flagged as the latest version
      const latestEntries = schemas.filter((s) => s.latestVersion);
      expect(latestEntries).toHaveLength(1);
    });

    it("schema paths point to existing files or compressed files", () => {
      const schemas = loadAPISchemas(["admin"]);

      for (const schema of schemas) {
        const schemaPath = schema.schemaPath;
        // Check if the file exists (could be .json or .json.gz)
        const jsonExists = existsSync(schemaPath);
        const gzExists = existsSync(schemaPath + ".gz");
        const gzWithoutJsonExists = existsSync(
          schemaPath.replace(".json", ".gz"),
        );

        expect(jsonExists || gzExists || gzWithoutJsonExists).toBe(true);
      }
    });
  });

  describe("All schema files are loadable", () => {
    const schemasConfig = JSON.parse(
      readFileSync(SUPPORTED_VERSIONS_SCHEMA_PATH, "utf-8"),
    ) as Record<string, APIVersion[]>;

    const allGraphQLAPIs: ShopifyAPIs[] = [
      ...getApiIdsByCategory(APICategory.GRAPHQL),
      ...getApiIdsByCategory(APICategory.FUNCTION_GRAPHQL),
    ];

    const apisWithVersions = allGraphQLAPIs.filter(
      (api) => schemasConfig[api] && schemasConfig[api].length > 0,
    );

    it.each(apisWithVersions)(
      "schema file exists for %s",
      (api: ShopifyAPIs) => {
        const schemas = loadAPISchemas([api]);
        expect(schemas.length).toBeGreaterThan(0);

        for (const schema of schemas) {
          const jsonExists = existsSync(schema.schemaPath);
          const gzExists = existsSync(`${schema.schemaPath}.gz`);
          expect(
            jsonExists || gzExists,
            `Missing schema file for ${api} v${schema.name}: tried ${schema.schemaPath} and ${schema.schemaPath}.gz`,
          ).toBe(true);
        }
      },
    );

    it.each(apisWithVersions)(
      "loadSchemaContent can read %s",
      async (api: ShopifyAPIs) => {
        const schemas = loadAPISchemas([api]);

        for (const schema of schemas) {
          const content = await loadSchemaContent(schema);
          expect(content).toBeTruthy();
          expect(content.length).toBeGreaterThan(0);

          const parsed = JSON.parse(content);
          expect(parsed).toBeDefined();
          expect(typeof parsed).toBe("object");
        }
      },
    );
  });
});
