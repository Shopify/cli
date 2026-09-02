import type {VersionCatalog} from './contract.js'

/**
 * Describes an already-resolved schema: which API and version it is, and the
 * absolute path its bytes live at on disk.
 */
export interface ResolvedApiSchema {
  api: string
  name: string
  schemaPath: string
  latestVersion: boolean
}

/**
 * Decouples schema *selection/validation* from where the schema bytes come
 * from. The default {@link createDiskSchemaSource} reads the version catalog and
 * the gzipped introspection JSON from the bundled asset directory. Tests (and
 * any future embedded-bytes source) can supply an alternative implementation so
 * validation never has to touch the filesystem.
 */
export interface SchemaSource {
  /** The `api -> versions` catalog (from `supported-versions-schema.json`). */
  readVersionCatalog: () => VersionCatalog
  /** The raw introspection JSON for an already-resolved schema. */
  readSchemaContent: (schema: ResolvedApiSchema) => Promise<string>
}
