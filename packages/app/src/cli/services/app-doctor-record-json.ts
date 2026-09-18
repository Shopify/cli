import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const AppDoctorRecordConfigurationSchema = zod
  .object({
    identity: zod.string(),
    path: zod.string(),
    name: zod.string(),
    client_id: zod.string().optional(),
  })
  .strict()

const AppDoctorRecordedCheckSchema = zod
  .object({
    check_id: zod.string(),
    outcome: zod.enum(['clean', 'findings', 'not_applicable', 'unresolved']),
    finding_count: zod.number().int().nonnegative(),
    /** Whether the store held an earlier agent result for this check; recording always writes a fresh one. */
    status: zod.enum(['created', 'replaced']),
  })
  .strict()

const AppDoctorRecordedScopeSchema = zod
  .object({
    scope_identity: zod.string(),
    /** Present when the scope is one of this invocation's current scopes. */
    directory: zod.string().optional(),
    checks: zod.array(AppDoctorRecordedCheckSchema),
  })
  .strict()

const AppDoctorRecordScoreSchema = zod.discriminatedUnion('status', [
  zod
    .object({
      status: zod.literal('graded'),
      total: zod.number(),
      grade: zod.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'POOR']),
    })
    .strict(),
  zod
    .object({
      status: zod.literal('withheld'),
      reason: zod.enum(['no_static_results', 'incomplete_static_coverage']),
    })
    .strict(),
])

const AppDoctorRecordSummarySchema = zod
  .object({
    scopes: zod.number().int().nonnegative(),
    findings: zod.number().int().nonnegative(),
    suppressed_findings: zod.number().int().nonnegative(),
    score: AppDoctorRecordScoreSchema,
    static_coverage_complete: zod.boolean(),
  })
  .strict()

const AppDoctorRecordDiagnosticSchema = zod
  .object({
    source: zod.enum(['store', 'record', 'scan']),
    code: zod.string(),
    message: zod.string(),
    path: zod.string().optional(),
  })
  .strict()

export const appDoctorRecordJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDoctorRecordResult',
  schema: zod
    .object({
      schema_version: zod.literal(1),
      configuration: AppDoctorRecordConfigurationSchema,
      app_root: zod.string(),
      /** One entry per submission, in submission order. */
      recorded: zod.array(AppDoctorRecordedScopeSchema),
      /** Read back from every stored result for this configuration, not just the ones recorded now. */
      summary: AppDoctorRecordSummarySchema,
      diagnostics: zod.array(AppDoctorRecordDiagnosticSchema),
      /** The exact command that reads the stored results back. */
      next: zod.string(),
    })
    .strict(),
  definitions: {
    AppDoctorRecordConfiguration: AppDoctorRecordConfigurationSchema,
    AppDoctorRecordedScope: AppDoctorRecordedScopeSchema,
    AppDoctorRecordedCheck: AppDoctorRecordedCheckSchema,
    AppDoctorRecordSummary: AppDoctorRecordSummarySchema,
    AppDoctorRecordScore: AppDoctorRecordScoreSchema,
    AppDoctorRecordDiagnostic: AppDoctorRecordDiagnosticSchema,
  },
})

export type AppDoctorRecordResult = InferJsonOutputSchema<typeof appDoctorRecordJsonOutputSchema>
