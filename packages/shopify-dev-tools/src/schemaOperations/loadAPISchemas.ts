import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APIVersion, ShopifyAPIs } from "../types/index.js";
import { SHOPIFY_APIS } from "../config/api-mappings.js";
import type { SchemaSource } from "./schemaSource.js";
import { loadSchemaContent } from "./loadSchemaContent.js";

// Extended APIVersion that includes which API it belongs to and the schema path
export interface APIVersionWithAPI extends APIVersion {
  api: ShopifyAPIs;
  schemaPath: string;
}

/**
 * Resolve the data directory path based on the current module location.
 * Handles various scenarios: npm package, local build, dev-mcp bundle, etc.
 */
function getDataDirectory(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // When bundled into dev-mcp, the data will be in the same dist directory
  if (
    currentDir.includes("dev-mcp") &&
    currentDir.includes("dist") &&
    !currentDir.includes("shopify-dev-tools")
  ) {
    return path.join(currentDir, "data");
  }

  // When in dist directory (either as npm package or local build)
  if (currentDir.includes("/dist") || currentDir.includes("\\dist")) {
    // The data is in dist/data, so we need to find the dist root
    const distIndex = currentDir.lastIndexOf(path.sep + "dist");
    if (distIndex !== -1) {
      const distRoot = currentDir.substring(0, distIndex + 5); // +5 for "/dist"
      return path.join(distRoot, "data");
    } else {
      // Fallback for bundled files directly in dist
      return path.join(currentDir, "data");
    }
  }

  // From shopify-dev-tools src/schemaOperations/, data is at src/data
  return path.resolve(currentDir, "../data");
}

export const dataDir = getDataDirectory();

/**
 * Default {@link SchemaSource}: reads the version catalog and schema bytes from
 * `dist/data` relative to this module. This is the only place that touches the
 * filesystem.
 */
export const diskSchemaSource: SchemaSource = {
  readVersionCatalog(): Record<string, APIVersion[]> {
    const schemasPath = path.join(dataDir, "supported-versions-schema.json");
    return JSON.parse(readFileSync(schemasPath, "utf-8")) as Record<
      string,
      APIVersion[]
    >;
  },
  readSchemaContent(schema: APIVersionWithAPI): Promise<string> {
    return loadSchemaContent(schema);
  },
};

function configuredSchemaPath(api: ShopifyAPIs): string | undefined {
  const apiConfig = SHOPIFY_APIS[api];
  if (apiConfig?.gqlSchemaPath) return apiConfig.gqlSchemaPath;
  if (apiConfig?.gqlSchemaFileName) {
    return path.join(dataDir, apiConfig.gqlSchemaFileName);
  }
  return undefined;
}

function schemaPathFor(api: ShopifyAPIs, versionName: string): string {
  return (
    configuredSchemaPath(api) ??
    path.join(dataDir, `${api}_${versionName}.json`)
  );
}

function deriveVersionNameFromSchemaFile(fileName: string): string {
  const baseName = fileName.replace(/\.json(?:\.gz)?$/, "");
  const versionSeparatorIndex = baseName.lastIndexOf("_");
  return versionSeparatorIndex === -1
    ? "latest"
    : baseName.slice(versionSeparatorIndex + 1);
}

export function loadAPISchemas(
  apis: ShopifyAPIs[],
  schemaOptions?: APIVersion,
  source: SchemaSource = diskSchemaSource,
): APIVersionWithAPI[] {
  if (apis.length === 0) {
    throw new Error("No APIs provided");
  }

  if (schemaOptions) {
    if (apis.length !== 1) {
      throw new Error(
        "schemaOptions can only be provided when requesting a single API",
      );
    }

    return [
      {
        ...schemaOptions,
        api: apis[0],
        schemaPath:
          (schemaOptions as APIVersionWithAPI).schemaPath ??
          schemaPathFor(apis[0], schemaOptions.name),
      },
    ];
  }

  const schemasConfig = source.readVersionCatalog();

  // Collect all API versions for the requested APIs
  const apiVersions: APIVersionWithAPI[] = [];

  for (const api of apis) {
    const versions = schemasConfig[api];
    if (versions) {
      const versionsWithApi = versions.map((v) => ({
        ...v,
        api,
        schemaPath: schemaPathFor(api, v.name),
      }));
      apiVersions.push(...versionsWithApi);
    } else {
      const apiConfig = SHOPIFY_APIS[api];
      const configuredPath = configuredSchemaPath(api);
      if (!configuredPath) continue;
      apiVersions.push({
        name: apiConfig?.gqlSchemaFileName
          ? deriveVersionNameFromSchemaFile(apiConfig.gqlSchemaFileName)
          : "latest",
        latestVersion: true,
        api,
        schemaPath: configuredPath,
      });
    }
  }

  return apiVersions;
}

/**
 * Load a single API schema configuration.
 * This is a convenience wrapper around loadAPISchemas for single API requests.
 * @param api - The API to load the schema for
 * @param schemaOptions - Optional specific schema version to use
 * @returns The APIVersionWithAPI configuration for the requested API
 */
export function loadAPISchema(
  api: ShopifyAPIs,
  schemaOptions?: APIVersion,
  source: SchemaSource = diskSchemaSource,
): APIVersionWithAPI {
  const schemas = loadAPISchemas([api], schemaOptions, source);
  if (schemas.length === 0) {
    throw new Error(`No schema found for API: ${api}`);
  }
  return schemas.find((s) => s.latestVersion) ?? schemas[0];
}
