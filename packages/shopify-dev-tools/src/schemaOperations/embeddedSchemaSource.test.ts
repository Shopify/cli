import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { validateGraphQLOperation } from "../validation/graphql.js";
import { ValidationResult } from "../types/index.js";
import {
  createEmbeddedSchemaSource,
  mergeSchemaSources,
} from "./embeddedSchemaSource.js";
import type { SchemaSource } from "./schemaSource.js";
import type { APIVersionWithAPI } from "./loadAPISchemas.js";

// The embedded modules under src/data-embedded/ are gitignored generated code.
// Only this suite needs them, so it generates them in `beforeAll` rather than a
// `pretest` hook that would fire for every (even unrelated) `pnpm test` run.
// `embed-schemas` is a no-op when the output is already up to date.
const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const ref = (api: string, name: string): APIVersionWithAPI =>
  ({ api, name, latestVersion: true, schemaPath: "" }) as APIVersionWithAPI;

const fakeSource = (api: string, name: string, body: string): SchemaSource =>
  createEmbeddedSchemaSource(
    { [api]: [{ name, latestVersion: true }] },
    { [`${api}:${name}`]: zlib.gzipSync(Buffer.from(body)).toString("base64") },
  );

// The factory/merge tests stand alone on hand-built bytes; the generated-source
// tests below exercise the embedded output and generate it on demand.
describe("createEmbeddedSchemaSource", () => {
  const source = fakeSource("admin", "2099-01", `{"data":{"__schema":{}}}`);

  it("returns the catalog it was built with", () => {
    expect(source.readVersionCatalog().admin[0].name).toBe("2099-01");
  });

  it("gunzips embedded bytes to the original JSON", async () => {
    const content = await source.readSchemaContent(ref("admin", "2099-01"));
    expect(JSON.parse(content).data.__schema).toBeDefined();
  });

  it("throws a helpful error for a key it does not hold", async () => {
    await expect(
      source.readSchemaContent(ref("admin", "1999-01")),
    ).rejects.toThrow(/No embedded schema for "admin:1999-01"/);
  });
});

describe("mergeSchemaSources", () => {
  it("merges different versions of the same API", async () => {
    const merged = mergeSchemaSources([
      fakeSource("admin", "v1", "A"),
      fakeSource("admin", "v2", "B"),
    ]);
    expect(merged.readVersionCatalog().admin.map((v) => v.name)).toEqual([
      "v1",
      "v2",
    ]);
    expect(await merged.readSchemaContent(ref("admin", "v1"))).toBe("A");
    expect(await merged.readSchemaContent(ref("admin", "v2"))).toBe("B");
  });

  it("merges different APIs", async () => {
    const merged = mergeSchemaSources([
      fakeSource("admin", "v1", "A"),
      fakeSource("storefront", "v1", "B"),
    ]);
    expect(Object.keys(merged.readVersionCatalog()).sort()).toEqual([
      "admin",
      "storefront",
    ]);
    expect(await merged.readSchemaContent(ref("storefront", "v1"))).toBe("B");
  });

  it("throws when no source lists the requested api:version", async () => {
    const merged = mergeSchemaSources([fakeSource("admin", "v1", "A")]);
    await expect(merged.readSchemaContent(ref("admin", "v9"))).rejects.toThrow(
      /No embedded schema source for "admin:v9"/,
    );
  });
});

describe("generated embedded sources", () => {
  let embeddedSchemaSource: SchemaSource;
  let adminSchemaSource: SchemaSource;

  beforeAll(async () => {
    execSync("pnpm embed-schemas", { cwd: pkgRoot, stdio: "ignore" });
    embeddedSchemaSource = (await import("../schema-embedded.js"))
      .embeddedSchemaSource;
    adminSchemaSource = (await import("../data-embedded/admin.js")).default;
  }, 60_000);

  it("exposes every admin version via the per-API module", () => {
    const versions = adminSchemaSource.readVersionCatalog().admin;
    expect(versions.length).toBeGreaterThan(1);
  });

  it("isolates a single version in its per-version module", async () => {
    const [version] = adminSchemaSource.readVersionCatalog().admin;
    const perVersion = (await import(`../data-embedded/admin_${version.name}`))
      .default as SchemaSource;
    expect(perVersion.readVersionCatalog().admin).toHaveLength(1);
    const content = await perVersion.readSchemaContent(
      ref("admin", version.name),
    );
    expect(JSON.parse(content).data.__schema).toBeDefined();
  });

  it("covers more than one API via the aggregate", () => {
    const apis = Object.keys(embeddedSchemaSource.readVersionCatalog());
    expect(apis).toContain("admin");
    expect(apis.length).toBeGreaterThan(1);
  });

  it("validates Admin operations end-to-end with no disk access", async () => {
    const bad = await validateGraphQLOperation(
      "{ shop { notAField } }",
      "admin",
      { failOnDeprecated: false, schemaSource: embeddedSchemaSource },
    );
    expect(bad.validation.result).toBe(ValidationResult.FAILED);
    expect(bad.validation.resultDetail).toContain("notAField");

    const good = await validateGraphQLOperation("{ shop { name } }", "admin", {
      failOnDeprecated: false,
      schemaSource: embeddedSchemaSource,
    });
    expect(good.validation.result).toBe(ValidationResult.SUCCESS);
  });
});
