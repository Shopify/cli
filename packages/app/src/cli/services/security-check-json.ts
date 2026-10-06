import {clientIdSource, effectiveClientId} from './app-security-selection.js'
import {appSecurityInstructionsSchema, type AppSecurityInstructionsJson} from './security-instructions-json.js'
import {deterministicFindingsDocumentSchema, type Equals} from './app-security-engine/index.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppSecurityEngineMetadata, AppSecurityExecution} from './app-security-api.js'
import type {AppSecurityScanDirectory, AppSecuritySelection} from './app-security-selection.js'

// Declared here rather than taken from the deterministic findings document schema: the JSON Schema published in the
// oclif manifest would render an instance shared with the nested document as a `$ref` instead of inline.
const engineSchema = zod.object({name: zod.string(), version: zod.string(), ruleset: zod.string()})

const scanDirectorySchema = zod.object({
  directory: zod.string(),
  origin: zod.enum(['app_directory', 'include_dir']),
})

const scanResultSchema = zod.object({
  engine: engineSchema,
  selection: zod.object({
    app_directory: zod.string(),
    app_config_file: zod.string().nullable(),
    client_id: zod.string().nullable(),
    client_id_source: zod.enum(['config', 'flag', 'picker']).nullable(),
    scan_directories: zod.array(scanDirectorySchema),
  }),
  deterministic_findings: deterministicFindingsDocumentSchema,
  agent_checks_path: zod.string(),
  /** The coding-agent instructions chosen at the prompt or with `--yes`; null when none were. */
  instructions: appSecurityInstructionsSchema.nullable(),
})

const fileListResultSchema = zod.object({files: zod.array(zod.string())})

// `--list-files` stops before scanning, so its result shares no field with a scan's. Consumers know which they asked
// for, and the two shapes have no key in common.
export const securityCheckJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityCheckResult',
  schema: zod.union([scanResultSchema, fileListResultSchema]),
  definitions: {
    AppSecurityCheckScanResult: scanResultSchema,
    AppSecurityCheckFileListResult: fileListResultSchema,
    AppSecurityInstructions: appSecurityInstructionsSchema,
  },
})

type SecurityCheckScanJsonResult = zod.infer<typeof scanResultSchema>

export type SecurityCheckJsonResult = InferJsonOutputSchema<typeof securityCheckJsonOutputSchema>

/**
 * The engine and scan directories pass straight through, and Zod strips unknown keys: without these pins a field
 * added to either later would silently vanish from `--json`.
 */
export const PASSTHROUGH_TYPES_MATCH_CHECK_JSON: Equals<AppSecurityEngineMetadata, zod.infer<typeof engineSchema>> &
  Equals<AppSecurityScanDirectory, zod.infer<typeof scanDirectorySchema>> = true

export function toSecurityCheckJson(
  execution: Pick<AppSecurityExecution, 'engine' | 'deterministicFindings'>,
  agentChecksPath: string,
  selection: AppSecuritySelection,
  scanDirectories: AppSecurityScanDirectory[],
  instructions: AppSecurityInstructionsJson | null,
): SecurityCheckScanJsonResult {
  return {
    engine: execution.engine,
    selection: {
      app_directory: selection.appDirectory,
      app_config_file: selection.kind === 'config' ? selection.appConfigFilePath : null,
      client_id: effectiveClientId(selection) ?? null,
      client_id_source: clientIdSource(selection) ?? null,
      scan_directories: scanDirectories,
    },
    deterministic_findings: execution.deterministicFindings,
    agent_checks_path: agentChecksPath,
    instructions,
  }
}
