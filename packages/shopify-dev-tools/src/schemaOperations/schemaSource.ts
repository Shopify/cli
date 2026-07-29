import type { APIVersion } from "../types/index.js";
import type { APIVersionWithAPI } from "./loadAPISchemas.js";

/**
 * Decouples schema *selection/validation* from where the schema bytes come
 * from. The default {@link diskSchemaSource} reads the catalog and `.json.gz`
 * schemas from `dist/data` relative to `import.meta.url`; an alternative source
 * (e.g. the build-time embedded ones in `./schema-embedded`) can instead supply
 * the same bytes from statically-importable constants, so validation need not
 * read the filesystem.
 */
export interface SchemaSource {
  /** The `api -> versions` catalog (normally `supported-versions-schema.json`). */
  readVersionCatalog(): Record<string, APIVersion[]>;
  /** The raw introspection JSON for an already-resolved schema. */
  readSchemaContent(schema: APIVersionWithAPI): Promise<string>;
}
