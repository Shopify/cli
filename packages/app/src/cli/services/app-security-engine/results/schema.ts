import {ENGINE_NAME, FINDINGS_SCHEMA_VERSION} from '../types.js'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AgentFindingsDocument, DeterministicFindingsDocument, FindingsDocument} from '../types.js'

/**
 * The Zod schema for schema_version 1 of the stored findings documents (§3).
 *
 * Required fields are strict and every enum is closed, so an unknown value makes the file unprocessable.
 * Unknown keys are stripped, which is `zod.object()`'s default. The hand-written interfaces in types.ts
 * stay the internal representation; the assertions at the bottom fail to compile the day the two diverge,
 * which is the signal that a new schema version needs an explicit mapping.
 *
 * The component schemas are exported so the public `review --json` schema is composed from them and
 * every closed enum is declared once.
 */

export const severitySchema = zod.enum(['high', 'medium', 'low'])
export const checkStatusSchema = zod.enum(['executed', 'not_applicable', 'unresolved'])
export const checkPrecedenceSchema = zod.enum(['union', 'prefer-agent'])

const locationSchema = zod.object({
  file: zod.string(),
  line: zod.number().optional(),
  column: zod.number().optional(),
})

const fixSchema = zod.object({
  automated: zod.boolean(),
  guide: zod.string().optional(),
  description: zod.string(),
})

const checkSnapshotSchema = zod.object({
  title: zod.string(),
  severity: severitySchema,
  description: zod.string(),
  guide: zod.string().optional(),
  current_version: zod.number(),
  precedence: checkPrecedenceSchema.optional(),
})

const storedEvidenceSchema = zod.object({
  location: locationSchema,
  quote: zod.string().optional(),
})

export const storedFindingSchema = zod.object({
  location: locationSchema,
  message: zod.string(),
  evidence: zod.array(storedEvidenceSchema),
  snippet: zod.string().optional(),
  fix: fixSchema.optional(),
  confidence: zod.enum(['high', 'medium', 'low']).optional(),
  reasoning: zod.string().optional(),
  suppression: zod.object({justification: zod.string()}).optional(),
})

export const storedCheckSchema = zod.object({
  id: zod.string(),
  version: zod.number(),
  status: checkStatusSchema,
  reason: zod.object({code: zod.string(), message: zod.string()}).optional(),
  analysis_mode: zod.enum(['regex', 'structured_config', 'ast']).optional(),
  snapshot: checkSnapshotSchema,
  findings: zod.array(storedFindingSchema),
})

/** A document records each check once; a repeated ID would otherwise silently last-win when the sources are combined. */
const storedChecksSchema = zod.array(storedCheckSchema).superRefine((checks, context) => {
  const seenIds = new Set<string>()
  checks.forEach((check, index) => {
    if (seenIds.has(check.id)) {
      context.addIssue({
        code: zod.ZodIssueCode.custom,
        path: [index, 'id'],
        message: `duplicate check id ${check.id}`,
      })
    }
    seenIds.add(check.id)
  })
})

export const projectDetectionSchema = zod.object({
  framework: zod.enum(['react_router', 'none', 'unknown', 'mixed']),
  surface: zod.enum(['react_router', 'theme_app_extension', 'config_only', 'unknown', 'mixed']),
  languages: zod.array(
    zod.object({
      name: zod.string(),
      support: zod.enum(['supported', 'unsupported']),
      files: zod.array(zod.string()),
    }),
  ),
})

export const coverageSchema = zod.object({
  files_scanned: zod.number(),
  files_skipped: zod.array(
    zod.object({
      path: zod.string(),
      reason: zod.enum(['too_large', 'unreadable']),
      size_bytes: zod.number().optional(),
      detail: zod.string().optional(),
    }),
  ),
  gaps: zod.array(
    zod.object({
      code: zod.enum(['skipped_file', 'unsupported_framework', 'unsupported_language', 'unresolved_check']),
      message: zod.string(),
      check_id: zod.string().optional(),
      file: zod.string().optional(),
    }),
  ),
})

const documentBase = {
  schema_version: zod.literal(FINDINGS_SCHEMA_VERSION),
  generated_at: zod.string(),
  checks: storedChecksSchema,
}

export const deterministicFindingsDocumentSchema = zod.object({
  ...documentBase,
  source: zod.literal('deterministic'),
  engine: zod.object({name: zod.literal(ENGINE_NAME), version: zod.string(), ruleset: zod.string()}),
  detection: projectDetectionSchema,
  coverage: coverageSchema,
})

export const agentFindingsDocumentSchema = zod.object({
  ...documentBase,
  source: zod.literal('agent'),
  engine: zod.object({name: zod.literal(ENGINE_NAME), version: zod.string()}),
})

export const findingsDocumentSchemaV1 = zod.discriminatedUnion('source', [
  deterministicFindingsDocumentSchema,
  agentFindingsDocumentSchema,
])

/** `true` only when TLeft and TRight are the same type; used to pin the interfaces to the schema. */
export type Equals<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false

export const STORED_TYPES_MATCH_SCHEMA_V1: Equals<
  DeterministicFindingsDocument,
  zod.infer<typeof deterministicFindingsDocumentSchema>
> &
  Equals<AgentFindingsDocument, zod.infer<typeof agentFindingsDocumentSchema>> &
  Equals<FindingsDocument, zod.infer<typeof findingsDocumentSchemaV1>> = true
