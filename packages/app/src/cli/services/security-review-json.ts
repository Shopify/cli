import {
  agentFindingsDocumentSchema,
  checkPrecedenceSchema,
  checkStatusSchema,
  coverageSchema,
  deterministicFindingsDocumentSchema,
  FINDINGS_SCHEMA_VERSION,
  projectDetectionSchema,
  severitySchema,
  storedCheckSchema,
  storedFindingSchema,
  type AgentFindingsDocument,
  type CombinedCheck,
  type DeterministicFindingsDocument,
  type Equals,
} from './app-security-engine/index.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {SecurityReviewResult} from './security-review.js'

/**
 * The public `--json` shape of `app security review` (§9.3). JSON never drops findings: every finding
 * appears with its `disposition`, and `--check-id` narrowing is explicit in `filter`. There are no
 * presentation fields (no next steps, labels or counts): those belong to the terminal presenter.
 *
 * The schemas are composed from the engine's stored-document schemas, so each closed enum is declared
 * once. Key order matters: `encode` serialises in schema order, so it is the order of the JSON output.
 */

const findingsSourceSchema = zod.enum(['deterministic', 'agent'])

const combinedFindingSchema = zod.object({
  source: findingsSourceSchema,
  disposition: zod.enum(['active', 'suppressed', 'superseded']),
  ...storedFindingSchema.shape,
})

// `pick` keeps the keys in the order of the mask; `generated_at` is the time the source recorded the check.
const sourceCheckResultSchema = storedCheckSchema
  .pick({version: true, status: true, reason: true, analysis_mode: true})
  .extend({generated_at: zod.string()})

const combinedCheckSchema = zod.object({
  id: zod.string(),
  title: zod.string(),
  severity: severitySchema,
  description: zod.string(),
  guide: zod.string().optional(),
  docs_url: zod.string().optional(),
  precedence: checkPrecedenceSchema,
  applied_precedence: checkPrecedenceSchema,
  status: checkStatusSchema,
  by_source: zod.object({
    deterministic: sourceCheckResultSchema.nullable(),
    agent: sourceCheckResultSchema.nullable(),
  }),
  findings: zod.array(combinedFindingSchema),
})

/**
 * Each source repeats its document's metadata, in the document's key order, but not its checks.
 * `schema_version` and `generated_at` are declared here rather than taken from the document schemas: the
 * two documents share those instances, and the JSON Schema published in the oclif manifest would render a
 * shared instance as a `$ref` instead of the inline definition it has today.
 */
const deterministicSourceSchema = zod.object({
  path: zod.string(),
  schema_version: zod.literal(FINDINGS_SCHEMA_VERSION),
  engine: deterministicFindingsDocumentSchema.shape.engine,
  generated_at: zod.string(),
  detection: projectDetectionSchema,
  coverage: coverageSchema,
})

const agentSourceSchema = zod.object({
  path: zod.string(),
  schema_version: zod.literal(FINDINGS_SCHEMA_VERSION),
  engine: agentFindingsDocumentSchema.shape.engine,
  generated_at: zod.string(),
  scope: agentFindingsDocumentSchema.shape.scope,
})

export const securityReviewJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityReviewResult',
  schema: zod.object({
    filter: zod.object({check_ids: zod.array(zod.string())}).nullable(),
    sources: zod.object({
      deterministic: deterministicSourceSchema.nullable(),
      agent: agentSourceSchema.nullable(),
    }),
    scope_differs: zod.boolean(),
    checks: zod.array(combinedCheckSchema),
  }),
  definitions: {
    AppSecurityDeterministicSource: deterministicSourceSchema,
    AppSecurityAgentSource: agentSourceSchema,
    AppSecurityCombinedCheck: combinedCheckSchema,
    AppSecurityCombinedFinding: combinedFindingSchema,
  },
})

type SecurityReviewJsonResult = InferJsonOutputSchema<typeof securityReviewJsonOutputSchema>

/** Pins the engine's types to the public schema. */
export const COMBINED_CHECK_MATCHES_REVIEW_JSON: Equals<CombinedCheck, zod.infer<typeof combinedCheckSchema>> = true

/**
 * Each source passes its document's metadata straight through, and Zod strips unknown keys: without these
 * pins a field added to a stored document later would silently vanish from `--json`.
 */
export const SOURCES_MATCH_REVIEW_JSON: Equals<
  Pick<DeterministicFindingsDocument, 'schema_version' | 'engine' | 'generated_at' | 'detection' | 'coverage'>,
  Omit<zod.infer<typeof deterministicSourceSchema>, 'path'>
> &
  Equals<
    Pick<AgentFindingsDocument, 'schema_version' | 'engine' | 'generated_at' | 'scope'>,
    Omit<zod.infer<typeof agentSourceSchema>, 'path'>
  > = true

/** Maps the service result to the public JSON shape. Each source repeats its metadata but not its checks. */
export function toSecurityReviewJson(result: SecurityReviewResult): SecurityReviewJsonResult {
  const {deterministic, agent} = result.sources
  return {
    filter: result.filter ? {check_ids: result.filter.checkIds} : null,
    sources: {
      deterministic: deterministic
        ? {
            path: deterministic.path,
            schema_version: deterministic.document.schema_version,
            engine: deterministic.document.engine,
            generated_at: deterministic.document.generated_at,
            detection: deterministic.document.detection,
            coverage: deterministic.document.coverage,
          }
        : null,
      agent: agent
        ? {
            path: agent.path,
            schema_version: agent.document.schema_version,
            engine: agent.document.engine,
            generated_at: agent.document.generated_at,
            scope: agent.document.scope,
          }
        : null,
    },
    scope_differs: result.scopeDiffers,
    checks: result.checks,
  }
}
