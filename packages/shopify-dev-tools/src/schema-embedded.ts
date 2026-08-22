// Build-time embedded schema sources, exposed at three granularities so a
// consumer imports only what it needs:
//   ./schema-embedded/admin_2026-04  one (api, version)
//   ./schema-embedded/admin          one API, every version
//   ./schema-embedded                every embedded API and version
export { embeddedSchemaSource, EMBEDDED_APIS } from "./data-embedded/index.js";
export {
  createEmbeddedSchemaSource,
  mergeSchemaSources,
} from "./schemaOperations/embeddedSchemaSource.js";
export type { SchemaSource } from "./schemaOperations/schemaSource.js";
