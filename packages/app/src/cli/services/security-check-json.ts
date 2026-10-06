import {clientIdSource, effectiveClientId} from './app-security-selection.js'
import {appSecurityInstructionsSchema, type AppSecurityInstructionsJson} from './security-instructions-json.js'
import {deterministicFindingsDocumentSchema, type Equals} from './app-security-engine/index.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppSecurityExecution} from './app-security-api.js'
import type {AppSecurityScanDirectory, AppSecuritySelection} from './app-security-selection.js'

const scanDirectorySchema = zod.object({
  directory: zod.string(),
  origin: zod.enum(['app_directory', 'include_dir']),
})

const scanResultSchema = zod.object({
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

/**
 * Scan directories pass straight through, and Zod strips unknown keys: without this pin a field added to them later
 * would silently vanish from `--json`.
 */
export const SCAN_DIRECTORY_MATCHES_CHECK_JSON: Equals<
  AppSecurityScanDirectory,
  zod.infer<typeof scanDirectorySchema>
> = true

export function toSecurityCheckJson(
  execution: Pick<AppSecurityExecution, 'deterministicFindings'>,
  agentChecksPath: string,
  selection: AppSecuritySelection,
  scanDirectories: AppSecurityScanDirectory[],
  instructions: AppSecurityInstructionsJson | null,
): SecurityCheckScanJsonResult {
  return {
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
