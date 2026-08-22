import { describe, expect, it, vi } from "vitest";
import {
  diskSchemaSource,
  loadAPISchemas,
} from "../schemaOperations/loadAPISchemas.js";
import type { SchemaSource } from "../schemaOperations/schemaSource.js";
import { ValidationResult } from "../types/index.js";
import { validateGraphQLOperation } from "./graphql.js";

describe("validation/graphql entry", () => {
  it("re-exports the ValidationResult enum (so consumers avoid the package root)", async () => {
    const mod = await import("./graphql.js");
    expect(mod.ValidationResult).toBe(ValidationResult);
  });

  it("validates a good Admin operation against the default on-disk source", async () => {
    const result = await validateGraphQLOperation(
      "{ shop { name } }",
      "admin",
      {
        failOnDeprecated: false,
      },
    );
    expect(result.validation.result).toBe(ValidationResult.SUCCESS);
  });

  it("fails an Admin operation with an unknown field", async () => {
    const result = await validateGraphQLOperation(
      "{ shop { notAField } }",
      "admin",
      { failOnDeprecated: false },
    );
    expect(result.validation.result).toBe(ValidationResult.FAILED);
    expect(result.validation.resultDetail).toContain("notAField");
  });

  it("consults the injected schema source instead of disk", async () => {
    const readSchemaContent = vi.fn((schema) =>
      diskSchemaSource.readSchemaContent(schema),
    );
    const source: SchemaSource = {
      readVersionCatalog: () => diskSchemaSource.readVersionCatalog(),
      readSchemaContent,
    };

    const result = await validateGraphQLOperation(
      "{ shop { notAField } }",
      "admin",
      { failOnDeprecated: false, schemaSource: source },
    );

    expect(readSchemaContent).toHaveBeenCalledTimes(1);
    expect(result.validation.result).toBe(ValidationResult.FAILED);
  });

  it("accepts an explicit version that only the injected source's catalog knows", async () => {
    // A source may legitimately carry versions this package's bundled catalog
    // does not (a custom or future schema). Naming such a version explicitly
    // must not be rejected: the version guard reads the injected source's
    // catalog, the same one `loadAPISchemas` consults. Before this was fixed,
    // the guard used the package-level SUPPORTED_API_VERSIONS and threw
    // "Unsupported version" for any version absent from the bundled catalog.
    const realAdmin =
      loadAPISchemas(["admin"], undefined, diskSchemaSource).find(
        (s) => s.latestVersion,
      ) ?? loadAPISchemas(["admin"], undefined, diskSchemaSource)[0];

    const source: SchemaSource = {
      // "2099-01" is not in the package's bundled supported-versions catalog.
      readVersionCatalog: () => ({
        admin: [{ name: "2099-01", latestVersion: true }],
      }),
      // Serve the real latest Admin bytes regardless of the requested name.
      readSchemaContent: () => diskSchemaSource.readSchemaContent(realAdmin),
    };

    const result = await validateGraphQLOperation(
      "{ shop { name } }",
      "admin",
      {
        apiVersion: { ...realAdmin, name: "2099-01" },
        failOnDeprecated: false,
        schemaSource: source,
      },
    );

    expect(result.validation.result).toBe(ValidationResult.SUCCESS);
  });
});
