import { describe, expect, it } from "vitest";
import { APIVersionWithAPI } from "./loadAPISchemas";

describe("GraphQL Types", () => {
  describe("Schema Types", () => {
    it("should have correct Schema interface structure", () => {
      const schema: APIVersionWithAPI = {
        api: "admin",
        name: "2025-07",
        latestVersion: true,
        schemaPath: "packages/shopify-dev-tools/src/data/admin_2025-07.json",
      };

      expect(schema.api).toBe("admin");
      expect(schema.name).toBe("2025-07");
      expect(schema.latestVersion).toBe(true);
      expect(schema.schemaPath).toBe(
        "packages/shopify-dev-tools/src/data/admin_2025-07.json",
      );
    });

    it("should have correct APIVersion interface structure", () => {
      const apiVersion: APIVersionWithAPI = {
        name: "2025-07",
        latestVersion: true,
        schemaPath: "packages/shopify-dev-tools/src/data/admin_2025-07.json",
        api: "admin",
      };

      expect(apiVersion.name).toBe("2025-07");
      expect(apiVersion.schemaPath).toContain("admin_2025-07.json");
      expect(apiVersion.latestVersion).toBe(true);
    });
  });
});
