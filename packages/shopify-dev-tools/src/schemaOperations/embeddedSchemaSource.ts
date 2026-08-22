import zlib from "node:zlib";
import type { APIVersion } from "../types/index.js";
import type { APIVersionWithAPI } from "./loadAPISchemas.js";
import { schemaCache } from "./schemaCache.js";
import type { SchemaSource } from "./schemaSource.js";

/**
 * Builds a {@link SchemaSource} from a catalog and gzipped schema bytes passed
 * in as constants (produced by scripts/embed-schemas.ts). The generator emits
 * one of these per `(api, version)`; callers normally import a ready-made
 * source rather than calling this directly.
 */
export function createEmbeddedSchemaSource(
  catalog: Record<string, APIVersion[]>,
  schemasGzBase64: Record<string, string>,
): SchemaSource {
  return {
    readVersionCatalog(): Record<string, APIVersion[]> {
      return catalog;
    },

    async readSchemaContent(schema: APIVersionWithAPI): Promise<string> {
      const key = `${schema.api}:${schema.name}`;
      const cached = schemaCache.get(key);
      if (cached) {
        return cached;
      }

      const base64 = schemasGzBase64[key];
      if (!base64) {
        throw new Error(
          `No embedded schema for "${key}". Embedded schemas: ${
            Object.keys(schemasGzBase64).join(", ") || "(none)"
          }. Regenerate with \`pnpm embed-schemas\`.`,
        );
      }

      const content = zlib
        .gunzipSync(Buffer.from(base64, "base64"))
        .toString("utf-8");
      schemaCache.set(key, content);
      return content;
    },
  };
}

/**
 * Merges several {@link SchemaSource}s into one. Works whether the sources
 * cover different APIs or different versions of the same API: catalogs are
 * unioned (first occurrence of an `api:version` wins, matching the read order
 * below), and `readSchemaContent` is delegated to the first source that lists
 * the requested `api:version`. Used to assemble the per-API and all-API
 * aggregates from the per-version modules.
 */
export function mergeSchemaSources(sources: SchemaSource[]): SchemaSource {
  return {
    readVersionCatalog(): Record<string, APIVersion[]> {
      const merged: Record<string, APIVersion[]> = {};
      for (const source of sources) {
        for (const [api, versions] of Object.entries(
          source.readVersionCatalog(),
        )) {
          const existing = (merged[api] ??= []);
          for (const version of versions) {
            if (!existing.some((v) => v.name === version.name)) {
              existing.push(version);
            }
          }
        }
      }
      return merged;
    },

    async readSchemaContent(schema: APIVersionWithAPI): Promise<string> {
      for (const source of sources) {
        const versions = source.readVersionCatalog()[schema.api] ?? [];
        if (versions.some((v) => v.name === schema.name)) {
          return source.readSchemaContent(schema);
        }
      }
      throw new Error(
        `No embedded schema source for "${schema.api}:${schema.name}".`,
      );
    },
  };
}
