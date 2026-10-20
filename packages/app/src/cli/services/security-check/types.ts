import {
  appSecurityAppSchema,
  appSecurityBlockingSchema,
  appSecurityInstructionsSchema,
  appSecurityScanDirectorySchema,
  appSecurityScopeSchema,
  createAbsolutePathSchema,
} from '../app-security-json-output.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

/** With --list-files, the result is the files that a scan would gather. */
const appSecurityCheckFileListSchema = zod
  .object({
    status: zod.literal('success'),
    app: appSecurityAppSchema,
    scope: appSecurityScopeSchema,
    scanDirectories: zod.array(appSecurityScanDirectorySchema).describe('The directories that a scan would walk.'),
    files: zod
      .array(zod.object({path: createAbsolutePathSchema().describe('The absolute path of the file.')}).strict())
      .describe(
        'The files that a scan would gather, ordered by their paths relative to the app directory, as listed without --json.',
      ),
  })
  .strict()
  .describe('With --list-files, the files that a scan would gather. Nothing is scanned or written.')

export const appSecurityCheckJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityCheckResult',
  schema: zod
    .union([
      zod
        .object({
          status: zod.literal('success'),
          valid: zod
            .boolean()
            .describe(
              'Whether --blocking passed: no finding of the scan has its own severity at or above the level. blocking.blockedCheckCount counts the checks with such findings, and --blocking none always passes. Run review --json for the findings.',
            ),
          app: appSecurityAppSchema,
          resultsDirectory: createAbsolutePathSchema().describe(
            'The absolute path of the results directory that holds the files the scan wrote.',
          ),
          deterministicFindingsPath: createAbsolutePathSchema().describe(
            'The absolute path of deterministic-findings.json, which the scan replaced.',
          ),
          agentChecksPath: createAbsolutePathSchema().describe(
            'The absolute path of agent-checks.json, which the scan replaced.',
          ),
          scope: appSecurityScopeSchema,
          scanDirectories: zod.array(appSecurityScanDirectorySchema).describe('The directories that the scan walked.'),
          agentCheckCount: zod
            .number()
            .int()
            .nonnegative()
            .describe('The number of checks in agent-checks.json for a coding agent to investigate.'),
          blocking: appSecurityBlockingSchema,
          instructions: appSecurityInstructionsSchema
            .optional()
            .describe(
              'The coding-agent instructions for this scan, with --print-instructions or when chosen at the prompt. Left out otherwise.',
            ),
        })
        .strict(),
      appSecurityCheckFileListSchema,
      zod
        .object({status: zod.literal('cancelled')})
        .strict()
        .describe(
          'Asked whether to scan without app configuration, the user declined. Nothing was scanned or written.',
        ),
    ])
    .describe('The scan and the files it wrote. With --list-files, the files that a scan would gather.'),
  definitions: {
    AppSecurityApp: appSecurityAppSchema,
    AppSecurityScope: appSecurityScopeSchema,
    AppSecurityScanDirectory: appSecurityScanDirectorySchema,
    AppSecurityBlocking: appSecurityBlockingSchema,
    AppSecurityInstructions: appSecurityInstructionsSchema,
    AppSecurityCheckFileList: appSecurityCheckFileListSchema,
  },
})

export type AppSecurityCheckResult = InferJsonOutputSchema<typeof appSecurityCheckJsonOutputSchema>
