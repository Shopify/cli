import {clientIdSource, effectiveClientId} from './app-security-selection.js'
import {appSecurityInstructionsSchema, type AppSecurityInstructionsJson} from './security-instructions-json.js'
import {deterministicFindingsDocumentSchema} from './app-security-engine/index.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppSecurityExecution} from './app-security-api.js'
import type {AppSecurityScanDirectory, AppSecuritySelection} from './app-security-selection.js'

const scanDirectorySchema = zod
  .object({
    directory: zod.string(),
    origin: zod.enum(['app-directory', 'include-dir']),
  })
  .strict()

// The internal origins keep the spelling of the deterministic findings document's `coverage.scan_directories`.
const SCAN_DIRECTORY_ORIGINS: {
  [origin in AppSecurityScanDirectory['origin']]: zod.infer<typeof scanDirectorySchema>['origin']
} = {
  app_directory: 'app-directory',
  include_dir: 'include-dir',
}

const scanResultSchema = zod
  .object({
    status: zod.literal('success'),
    selection: zod
      .object({
        directory: zod.string(),
        configPath: zod.string().nullable(),
        clientId: zod.string().nullable(),
        clientIdSource: zod.enum(['config', 'flag', 'picker']).nullable(),
        scanDirectories: zod.array(scanDirectorySchema),
      })
      .strict(),
    deterministicFindings: deterministicFindingsDocumentSchema.describe(
      'The deterministic findings document, as written to deterministic-findings.json. It keeps its own field conventions and is versioned by its schema_version, independently of this result.',
    ),
    agentChecksPath: zod.string(),
    /** The coding-agent instructions chosen at the prompt or with `--yes`; null when none were. */
    instructions: appSecurityInstructionsSchema.nullable(),
  })
  .strict()

const fileListResultSchema = zod
  .object({
    status: zod.literal('success'),
    files: zod.array(zod.string()).describe('The absolute path of each file the check would gather.'),
  })
  .strict()

const cancelledResultSchema = zod.object({status: zod.literal('cancelled')}).strict()

// `--list-files` stops before scanning, so its result shares only `status` with a scan's; consumers know which they
// asked for. The file list has `status` although it can't be cancelled, so a prompt added there later keeps its shape.
export const securityCheckJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityCheckResult',
  schema: zod.union([scanResultSchema, fileListResultSchema, cancelledResultSchema]),
  definitions: {
    AppSecurityCheckScanResult: scanResultSchema,
    AppSecurityCheckFileListResult: fileListResultSchema,
    AppSecurityCheckCancelledResult: cancelledResultSchema,
    AppSecurityInstructions: appSecurityInstructionsSchema,
  },
})

type SecurityCheckScanJsonResult = zod.infer<typeof scanResultSchema>

/** `paths` are relative to the app directory, as the text output prints them. */
export function toSecurityCheckFileListJson(
  appDirectory: string,
  paths: string[],
): zod.infer<typeof fileListResultSchema> {
  return {status: 'success', files: paths.map((path) => resolvePath(appDirectory, path))}
}

/** The user declined to scan without app configuration. */
export function toSecurityCheckCancelledJson(): zod.infer<typeof cancelledResultSchema> {
  return {status: 'cancelled'}
}

export function toSecurityCheckJson(
  execution: Pick<AppSecurityExecution, 'deterministicFindings'>,
  agentChecksPath: string,
  selection: AppSecuritySelection,
  scanDirectories: AppSecurityScanDirectory[],
  instructions: AppSecurityInstructionsJson | null,
): SecurityCheckScanJsonResult {
  return {
    status: 'success',
    selection: {
      directory: selection.appDirectory,
      configPath: selection.kind === 'config' ? selection.appConfigFilePath : null,
      clientId: effectiveClientId(selection) ?? null,
      clientIdSource: clientIdSource(selection) ?? null,
      scanDirectories: scanDirectories.map(({directory, origin}) => ({
        directory,
        origin: SCAN_DIRECTORY_ORIGINS[origin],
      })),
    },
    deterministicFindings: execution.deterministicFindings,
    agentChecksPath,
    instructions,
  }
}
