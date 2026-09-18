import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const AppDoctorStatusConfigurationSchema = zod
  .object({
    identity: zod.string(),
    path: zod.string(),
    name: zod.string(),
    client_id: zod.string().optional(),
  })
  .strict()

const AppDoctorStatusStoreSchema = zod
  .object({
    directory: zod.string(),
    /** `missing` is a normal state: nothing has been recorded for this configuration yet. */
    state: zod.enum(['present', 'missing']),
  })
  .strict()

/** Mirrors the execution reason codes of the stored result schema (`app-doctor-engine/results/schema.ts`). */
const AppDoctorStatusExecutionReasonCodeSchema = zod.enum([
  'capability_absent',
  'no_relevant_files',
  'unsupported_framework',
  'unsupported_language',
  'parser_unavailable',
  'agent_investigation_required',
  'not_reported',
  'input_rejected',
])

const AppDoctorStatusExecutionReasonSchema = zod
  .object({code: AppDoctorStatusExecutionReasonCodeSchema, message: zod.string()})
  .strict()

/** The outcome of one mode for one check. Absence is `not_run`, never "passed". */
const AppDoctorStatusModeOutcomeSchema = zod.union([
  zod.object({outcome: zod.literal('not_run')}).strict(),
  zod
    .object({
      outcome: zod.enum(['clean', 'findings', 'not_applicable', 'unsupported_framework', 'unresolved']),
      produced_at: zod.string(),
      check_version: zod.number().int().positive(),
      finding_count: zod.number().int().nonnegative(),
      reason: AppDoctorStatusExecutionReasonSchema.optional(),
      guidance: zod.string().optional(),
    })
    .strict(),
])

const AppDoctorStatusCheckSchema = zod
  .object({
    check_id: zod.string(),
    static: AppDoctorStatusModeOutcomeSchema,
    agent: AppDoctorStatusModeOutcomeSchema,
  })
  .strict()

/** Only scopes with at least one recorded result are listed. */
const AppDoctorStatusScopeSchema = zod
  .object({
    scope_identity: zod.string(),
    /**
     * Where the scope's directory would be on this machine today, as an absolute path projected from the
     * recorded scope descriptor without touching the filesystem. When no local spelling exists (another
     * Windows volume) this is the recorded directory reference instead, and `directory_resolved` is false.
     */
    directory: zod.string(),
    directory_resolved: zod.boolean(),
    checks: zod.array(AppDoctorStatusCheckSchema),
  })
  .strict()

const AppDoctorStatusLocationSchema = zod
  .object({
    /**
     * The recorded evidence reference (`anchor/<up>/<path>` or `volume/<token>/<path>`), stable across
     * machines and checkout moves. Compare findings by this, never by `path`.
     */
    file: zod.string(),
    /**
     * Where `file` would be on this machine today, as an absolute path. Projected from the current storage
     * anchor without touching the filesystem; absent for files on another Windows volume.
     */
    path: zod.string().optional(),
    line: zod.number().int().positive().optional(),
    column: zod.number().int().positive().optional(),
  })
  .strict()

const AppDoctorStatusSuppressionSchema = zod.object({id: zod.string(), justification: zod.string()}).strict()

const AppDoctorStatusFixSchema = zod
  .object({
    /** True when the fix can be applied without a human deciding how. */
    automated: zod.boolean(),
    description: zod.string(),
    guide: zod.string().optional(),
  })
  .strict()

/** A suppression whose fingerprint matched no stored finding; it has no effect until one does. */
const AppDoctorStatusUnmatchedSuppressionSchema = zod
  .object({id: zod.string(), finding_fingerprint: zod.string()})
  .strict()

const AppDoctorStatusScoringSchema = zod.object({eligible: zod.boolean(), points: zod.number()}).strict()

const AppDoctorStatusFindingSchema = zod
  .object({
    fingerprint: zod.string(),
    scope_identity: zod.string(),
    code: zod.string(),
    severity: zod.enum(['high', 'medium', 'low']),
    title: zod.string(),
    message: zod.string(),
    location: AppDoctorStatusLocationSchema,
    /** Modes that observed this finding, static first. */
    sources: zod.array(zod.enum(['static', 'agent'])),
    /** Suppressed findings are included here; text output only counts them. */
    suppressed: zod.boolean(),
    suppression: AppDoctorStatusSuppressionSchema.optional(),
    fix: AppDoctorStatusFixSchema,
    scoring: AppDoctorStatusScoringSchema,
  })
  .strict()

const AppDoctorStatusCoverageOwnerSchema = zod.object({scope_identity: zod.string(), check_id: zod.string()}).strict()

const AppDoctorStatusCoverageGapSchema = zod
  .object({
    code: zod.enum(['skipped_file', 'unsupported_language', 'unresolved_check']),
    message: zod.string(),
    file: zod.string().optional(),
    owner: AppDoctorStatusCoverageOwnerSchema.optional(),
  })
  .strict()

const AppDoctorStatusCoverageOwnerSummarySchema = AppDoctorStatusCoverageOwnerSchema.extend({
  files_scanned: zod.number().int().nonnegative(),
  gap_count: zod.number().int().nonnegative(),
}).strict()

const AppDoctorStatusCoverageSchema = zod
  .object({
    static_result_count: zod.number().int().nonnegative(),
    /** True only when static results exist and none reports a gap. */
    complete: zod.boolean(),
    files_skipped: zod.number().int().nonnegative(),
    unsupported_languages: zod.array(zod.string()),
    gaps: zod.array(AppDoctorStatusCoverageGapSchema),
    owners: zod.array(AppDoctorStatusCoverageOwnerSummarySchema),
  })
  .strict()

const AppDoctorStatusScoreSchema = zod.union([
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

const AppDoctorStatusSuppressionsSchema = zod
  .object({
    matched: zod.number().int().nonnegative(),
    suppressed_findings: zod.number().int().nonnegative(),
    unmatched: zod.array(AppDoctorStatusUnmatchedSuppressionSchema),
  })
  .strict()

const AppDoctorStatusDiagnosticSchema = zod
  .object({
    source: zod.enum(['store', 'record', 'scan']),
    code: zod.string(),
    message: zod.string(),
    path: zod.string().optional(),
  })
  .strict()

export const appDoctorStatusJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDoctorStatusResult',
  schema: zod
    .object({
      schema_version: zod.literal(1),
      /** Always `stored-results`: no scan was performed, results reflect the tree when each was recorded. */
      basis: zod.literal('stored-results'),
      configuration: AppDoctorStatusConfigurationSchema,
      app_root: zod.string(),
      store: AppDoctorStatusStoreSchema,
      scopes: zod.array(AppDoctorStatusScopeSchema),
      findings: zod.array(AppDoctorStatusFindingSchema),
      coverage: AppDoctorStatusCoverageSchema,
      score: AppDoctorStatusScoreSchema,
      suppressions: AppDoctorStatusSuppressionsSchema,
      diagnostics: zod.array(AppDoctorStatusDiagnosticSchema),
    })
    .strict(),
  definitions: {
    AppDoctorStatusConfiguration: AppDoctorStatusConfigurationSchema,
    AppDoctorStatusStore: AppDoctorStatusStoreSchema,
    AppDoctorStatusScope: AppDoctorStatusScopeSchema,
    AppDoctorStatusCheck: AppDoctorStatusCheckSchema,
    AppDoctorStatusModeOutcome: AppDoctorStatusModeOutcomeSchema,
    AppDoctorStatusFinding: AppDoctorStatusFindingSchema,
    AppDoctorStatusLocation: AppDoctorStatusLocationSchema,
    AppDoctorStatusFix: AppDoctorStatusFixSchema,
    AppDoctorStatusUnmatchedSuppression: AppDoctorStatusUnmatchedSuppressionSchema,
    AppDoctorStatusCoverage: AppDoctorStatusCoverageSchema,
    AppDoctorStatusCoverageGap: AppDoctorStatusCoverageGapSchema,
    AppDoctorStatusScore: AppDoctorStatusScoreSchema,
    AppDoctorStatusSuppressions: AppDoctorStatusSuppressionsSchema,
    AppDoctorStatusDiagnostic: AppDoctorStatusDiagnosticSchema,
  },
})

export type AppDoctorStatusResult = InferJsonOutputSchema<typeof appDoctorStatusJsonOutputSchema>
export type AppDoctorStatusScope = AppDoctorStatusResult['scopes'][number]
export type AppDoctorStatusCheck = AppDoctorStatusScope['checks'][number]
export type AppDoctorStatusModeOutcome = AppDoctorStatusCheck['static']
export type AppDoctorStatusFinding = AppDoctorStatusResult['findings'][number]
