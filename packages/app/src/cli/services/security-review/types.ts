import {
  appSecurityAppSchema,
  appSecurityBlockingSchema,
  appSecurityScanDirectorySchema,
  appSecurityScopeSchema,
  createAbsolutePathSchema,
} from '../app-security/types.js'
import {
  defineJsonOutputSchema,
  jsonOutputTimestampSchema,
  type InferJsonOutputSchema,
} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

/*
 * Functions, so each field gets its own instance, as with createAbsolutePathSchema: the JSON Schema would render a
 * shared instance as a `$ref` into the first field that uses it.
 */
const createTimestampSchema = () => jsonOutputTimestampSchema.describe(`${jsonOutputTimestampSchema.description}`)
const createCheckStatusSchema = () => zod.enum(['executed', 'not-applicable', 'unresolved'])
const createPrecedenceSchema = () => zod.enum(['union', 'prefer-agent'])

/** Lines and columns are one-based, as the results files record them. */
const appSecurityLocationSchema = zod
  .object({
    filePath: createAbsolutePathSchema().describe('The absolute path of the file.'),
    line: zod.number().int().positive().nullable().describe('The one-based line, or null for the whole file.'),
    column: zod.number().int().positive().nullable().describe('The one-based column, or null when none is recorded.'),
  })
  .strict()
  .describe('A place in a file.')

const appSecurityEvidenceSchema = zod
  .object({
    location: appSecurityLocationSchema,
    quote: zod.string().min(1).nullable().describe('The quoted source, redacted, or null when none is recorded.'),
  })
  .strict()
  .describe('Source that supports a finding.')

/** The fields that findings from both sources have, in a function so each source's finding gets its own instances. */
const findingFields = () => ({
  disposition: zod
    .enum(['active', 'suppressed', 'superseded'])
    .describe(
      "Whether the finding counts: active; suppressed by the agent; or superseded, a deterministic finding that a check's prefer-agent agent result replaces.",
    ),
  location: appSecurityLocationSchema,
  message: zod.string().describe('What the finding is, redacted.'),
  snippet: zod.string().min(1).nullable().describe('The flagged code, redacted, or null when none is recorded.'),
  evidence: zod.array(appSecurityEvidenceSchema),
})

const appSecurityDeterministicFindingSchema = zod
  .object({
    source: zod.literal('deterministic'),
    ...findingFields(),
    fix: zod
      .object({
        description: zod.string(),
        guide: zod.string().min(1).nullable().describe('A guide to the fix, or null when none is recorded.'),
        automated: zod.boolean().describe('Whether the fix can be applied automatically.'),
      })
      .strict()
      .nullable()
      .describe('How to fix the finding, or null when none is recorded.'),
  })
  .strict()
  .describe('A finding from deterministic-findings.json.')

const appSecurityAgentFindingSchema = zod
  .object({
    source: zod.literal('agent'),
    ...findingFields(),
    confidence: zod
      .enum(['high', 'medium', 'low'])
      .nullable()
      .describe("The agent's confidence, or null when it didn't report one."),
    reasoning: zod
      .string()
      .min(1)
      .nullable()
      .describe("The agent's reasoning, redacted, or null when none is recorded."),
    suppression: zod
      .object({justification: zod.string()})
      .strict()
      .nullable()
      .describe('Why the agent suppressed the finding, or null when it is not suppressed.'),
  })
  .strict()
  .describe('A finding from agent-findings.json.')

const appSecurityFindingSchema = zod.discriminatedUnion('source', [
  appSecurityDeterministicFindingSchema,
  appSecurityAgentFindingSchema,
])

const appSecuritySourceResultSchema = zod
  .object({
    version: zod
      .number()
      .int()
      .positive()
      .describe(
        'The check version: the catalog version for deterministic results, the one the agent claimed for agent results.',
      ),
    status: createCheckStatusSchema().describe("The source's own status for the check."),
    reason: zod
      .object({
        code: zod
          .string()
          .describe(
            'A short code. Agent codes are free-form. Deterministic codes: capability_absent, no_relevant_files, unsupported_framework, unsupported_language, parser_unavailable, agent_investigation_required, input_rejected.',
          ),
        message: zod.string(),
      })
      .strict()
      .nullable()
      .describe('Why the check is unresolved or not applicable, or null when none is recorded.'),
    analysisMode: zod
      .enum(['regex', 'structured-config', 'ast'])
      .nullable()
      .describe('How the deterministic check analyzed the files. Null for agent results.'),
    generatedAt: createTimestampSchema()
      .nullable()
      .describe('When the source recorded the check, or null when the recorded time is not a valid instant.'),
  })
  .strict()
  .describe("One source's own result for a check.")

const appSecurityCheckSchema = zod
  .object({
    id: zod.string().describe('The check ID, such as CREDENTIAL_LOG_LEAKAGE.'),
    title: zod.string(),
    severity: zod.enum(['high', 'medium', 'low']),
    description: zod.string(),
    guide: zod.string().min(1).nullable().describe('A guide to the check, or null when none is recorded.'),
    docsUrl: zod
      .string()
      .url()
      .nullable()
      .describe("The check's page on shopify.dev, or null when the results files predate it."),
    precedence: createPrecedenceSchema().describe(
      "How the sources combine: union keeps both sources' findings; prefer-agent lets the agent result replace the deterministic one.",
    ),
    appliedPrecedence: createPrecedenceSchema().describe(
      'The precedence that applied: union when a prefer-agent agent result is older than the deterministic one.',
    ),
    status: createCheckStatusSchema().describe(
      'The combined status. Under union, executed when either source executed the check.',
    ),
    bySource: zod
      .object({
        deterministic: appSecuritySourceResultSchema.nullable(),
        agent: appSecuritySourceResultSchema.nullable(),
      })
      .strict()
      .describe("Each source's own result, or null when that source didn't record the check."),
    findings: zod
      .array(appSecurityFindingSchema)
      .describe(
        'Every finding of both sources, including suppressed and superseded ones, whatever --verbose. Sorted by file, line, then source.',
      ),
  })
  .strict()
  .describe('One check, combined from both results files.')

const appSecurityDetectionSchema = zod
  .object({
    framework: zod.enum(['react-router', 'none', 'unknown', 'mixed']),
    surface: zod.enum(['react-router', 'theme-app-extension', 'config-only', 'unknown', 'mixed']),
    languages: zod.array(
      zod
        .object({
          name: zod.string().describe('The language, such as typescript.'),
          support: zod.enum(['supported', 'unsupported']).describe('Whether the deterministic checks analyze it.'),
          files: zod.array(zod.object({path: createAbsolutePathSchema()}).strict()),
        })
        .strict(),
    ),
  })
  .strict()
  .describe('What the latest check detected in the app.')

const appSecurityCoverageSchema = zod
  .object({
    filesScanned: zod.number().int().nonnegative().describe('The number of files scanned.'),
    filesSkipped: zod.array(
      zod
        .object({
          path: createAbsolutePathSchema(),
          reason: zod.enum(['too-large', 'unreadable']),
          sizeBytes: zod.number().int().nonnegative().nullable().describe('The file size, or null when unknown.'),
          detail: zod
            .string()
            .min(1)
            .nullable()
            .describe('Why the file was unreadable, or null when none is recorded.'),
        })
        .strict(),
    ),
    gaps: zod.array(
      zod
        .object({
          code: zod.enum(['skipped-file', 'unsupported-framework', 'unsupported-language', 'unresolved-check']),
          message: zod.string(),
          checkId: zod.string().nullable().describe('The check that the gap concerns, or null.'),
          filePath: createAbsolutePathSchema().nullable().describe('The file that the gap concerns, or null.'),
        })
        .strict(),
    ),
    scanDirectories: zod.array(appSecurityScanDirectorySchema),
  })
  .strict()
  .describe('What the latest check covered.')

const appSecurityDeterministicResultsFileSchema = zod
  .object({
    path: createAbsolutePathSchema().describe('The absolute path of deterministic-findings.json.'),
    generatedAt: createTimestampSchema()
      .nullable()
      .describe('When check wrote the file, or null when the recorded time is not a valid instant.'),
    engine: zod.object({name: zod.string(), version: zod.string(), ruleset: zod.string()}).strict(),
    scope: appSecurityScopeSchema,
  })
  .strict()
  .describe('deterministic-findings.json, which check writes, with the scope of the scan.')

const appSecurityAgentResultsFileSchema = zod
  .object({
    path: createAbsolutePathSchema().describe('The absolute path of agent-findings.json.'),
    generatedAt: createTimestampSchema()
      .nullable()
      .describe('When record wrote the file, or null when the recorded time is not a valid instant.'),
    engine: zod.object({name: zod.string(), version: zod.string()}).strict(),
    scope: appSecurityScopeSchema,
  })
  .strict()
  .describe('agent-findings.json, which record writes, with the scope that the agent reported.')

export const appSecurityReviewJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityReviewResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      valid: zod
        .boolean()
        .describe(
          'Whether --blocking passed: no check in checks has an active finding and a severity at or above the level. Unresolved checks never fail it, and --blocking none always passes.',
        ),
      app: appSecurityAppSchema,
      resultsDirectory: createAbsolutePathSchema().describe('The absolute path of the results directory.'),
      resultsFiles: zod
        .object({
          deterministic: appSecurityDeterministicResultsFileSchema.nullable(),
          agent: appSecurityAgentResultsFileSchema.nullable(),
        })
        .strict()
        .describe('The results files that the review combines. Null when a file does not exist.'),
      detection: appSecurityDetectionSchema
        .nullable()
        .describe('What the latest check detected in the app, or null without deterministic-findings.json.'),
      coverage: appSecurityCoverageSchema
        .nullable()
        .describe('What the latest check covered, or null without deterministic-findings.json.'),
      scopeDiffers: zod
        .boolean()
        .describe(
          'Whether the agent reported another scope than the latest scan used. False unless both results files exist.',
        ),
      checks: zod
        .array(appSecurityCheckSchema)
        .describe('The checks after --check-id, most severe first, then by ID. Empty when no results file exists.'),
      blocking: appSecurityBlockingSchema,
    })
    .strict()
    .describe('The combined results of the app security check.'),
  definitions: {
    AppSecurityApp: appSecurityAppSchema,
    AppSecurityScope: appSecurityScopeSchema,
    AppSecurityScanDirectory: appSecurityScanDirectorySchema,
    AppSecurityBlocking: appSecurityBlockingSchema,
    AppSecurityDeterministicResultsFile: appSecurityDeterministicResultsFileSchema,
    AppSecurityAgentResultsFile: appSecurityAgentResultsFileSchema,
    AppSecurityDetection: appSecurityDetectionSchema,
    AppSecurityCoverage: appSecurityCoverageSchema,
    AppSecurityCheck: appSecurityCheckSchema,
    AppSecuritySourceResult: appSecuritySourceResultSchema,
    AppSecurityFinding: appSecurityFindingSchema,
    AppSecurityDeterministicFinding: appSecurityDeterministicFindingSchema,
    AppSecurityAgentFinding: appSecurityAgentFindingSchema,
    AppSecurityLocation: appSecurityLocationSchema,
    AppSecurityEvidence: appSecurityEvidenceSchema,
  },
})

export type AppSecurityReviewResult = InferJsonOutputSchema<typeof appSecurityReviewJsonOutputSchema>
