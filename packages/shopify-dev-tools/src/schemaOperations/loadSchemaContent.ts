import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import type { APIVersionWithAPI } from "./loadAPISchemas.js";
import { schemaCache } from "./schemaCache.js";

/**
 * SDL schemas describe types but lack the introspection envelope that validation
 * and introspection tooling expects. Convert to { data: __schema } so callers
 * get a consistent JSON format regardless of the source file format.
 */
async function convertSdlToIntrospectionJson(
  schemaPath: string,
): Promise<string> {
  const { buildSchema, introspectionFromSchema } = await import("graphql");
  const sdl = await fs.readFile(schemaPath, "utf-8");
  const introspection = introspectionFromSchema(buildSchema(sdl));
  return JSON.stringify({ data: introspection });
}

export async function loadSchemaContent(
  schema: APIVersionWithAPI,
): Promise<string> {
  const schemaPath = schema.schemaPath;

  // Check cache first
  const cached = schemaCache.get(schemaPath);
  if (cached) {
    return cached;
  }

  try {
    let content: string;

    if (schemaPath.endsWith(".gz")) {
      const compressedData = await fs.readFile(schemaPath);
      content = zlib.gunzipSync(compressedData).toString("utf-8");
    } else if (
      schemaPath.endsWith(".graphql") ||
      schemaPath.endsWith(".graphqls") ||
      schemaPath.endsWith(".gql")
    ) {
      content = await convertSdlToIntrospectionJson(schemaPath);
    } else if (existsSync(schemaPath)) {
      content = await fs.readFile(schemaPath, "utf-8");
    } else {
      const gzPath = `${schemaPath}.gz`;
      if (existsSync(gzPath)) {
        const compressedData = await fs.readFile(gzPath);
        content = zlib.gunzipSync(compressedData).toString("utf-8");
      } else {
        throw new Error(`Schema file not found at ${schemaPath} or ${gzPath}`);
      }
    }

    // Cache the content before returning
    schemaCache.set(schemaPath, content);
    return content;
  } catch (error) {
    console.error(`[graphql-schema-utils] Error loading schema: ${error}`);
    throw error;
  }
}
