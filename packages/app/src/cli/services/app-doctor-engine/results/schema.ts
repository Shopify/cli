/**
 * Wire and input schemas for App Doctor results.
 *
 * Every object is `.strict()` explicitly: cli-kit's `deepStrict` does not
 * descend into arrays or unions, and this contract must reject unknown fields
 * at every level. Static and agent results share one envelope and one
 * mandatory scope descriptor; the discriminated unions only add mode-specific
 * fields.
 */
import {
  APP_DOCTOR_DIAGNOSTIC_PATHS,
  AppDoctorScopeDescriptorSchema,
  SHA256_DIGEST,
  isAppDoctorEvidencePath,
  toPortablePath,
} from './scope.js'
import {redactText} from '../rules/secret-rules.js'
import {ENGINE_NAME} from '../types.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const APP_DOCTOR_RESULT_SCHEMA_VERSION = 1 as const
export const FINDING_IDENTITY_VERSION = 1 as const

/**
 * Owner identity grammars. The store derives filenames from these values
 * verbatim (`<config32>/results/<scope32>.<CHECK_ID>.<mode>.json`), so the
 * schema pins their shape before anything reaches disk.
 */
/** First 32 hex characters of the configuration preimage digest; see `context/storage.ts`. */
export const CONFIGURATION_IDENTITY_PATTERN = /^[0-9a-f]{32}$/
/** Catalogue check ids: SCREAMING_SNAKE_CASE, letter-led, at most 64 characters. */
export const CHECK_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

const MAX_TEXT_LENGTH = 64_000
const MAX_PATH_LENGTH = 4096

const text = zod.string().max(MAX_TEXT_LENGTH)
const nonemptyText = text.refine((value) => value.trim().length > 0, 'must not be blank')
/**
 * Identity and provenance values are preserved exactly. If redaction would
 * rewrite one, its meaning would change, so such values are rejected instead.
 */
const identity = zod
  .string()
  .max(MAX_TEXT_LENGTH)
  .refine((value) => value.trim().length > 0, 'must not be blank')
  .refine((value) => redactText(value) === value, 'must not contain secret-like values')
const digest = zod.string().regex(SHA256_DIGEST, 'must be a sha256 digest')
const configurationIdentity = zod.string().regex(CONFIGURATION_IDENTITY_PATTERN, 'must be 32 lowercase hex characters')
const checkId = zod.string().regex(CHECK_ID_PATTERN, 'must be an uppercase check id')
const count = zod.number().int().nonnegative().safe()
const positiveInteger = zod.number().int().positive().safe()
/** Exactly `Date#toISOString()` output: millisecond precision with a `Z` suffix, so timestamps compare as strings. */
const utcTimestamp = zod.string().refine((value) => {
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
}, 'must be a Date#toISOString() UTC timestamp with millisecond precision')

/** Stored data must already be portable; input may still carry Windows separators. */
const storedEvidencePath = zod.string().max(MAX_PATH_LENGTH).refine(isAppDoctorEvidencePath, 'invalid evidence path')
const inputEvidencePath = zod
  .string()
  .max(MAX_PATH_LENGTH)
  .refine((value) => isAppDoctorEvidencePath(toPortablePath(value)), 'invalid evidence path')

export const AppDoctorResultOwnerSchema = zod
  .object({
    configuration_identity: configurationIdentity,
    scope_identity: digest,
    check_id: checkId,
    mode: zod.enum(['static', 'agent']),
  })
  .strict()

export const SemanticFindingKeySchema = zod.object({namespace: zod.literal('semantic-v1'), value: identity}).strict()
export const DiagnosticFindingKeySchema = zod.object({namespace: zod.literal('diagnostic-v1'), value: digest}).strict()
export const AppDoctorFindingKeySchema = zod.discriminatedUnion('namespace', [
  SemanticFindingKeySchema,
  DiagnosticFindingKeySchema,
])

const severity = zod.enum(['high', 'medium', 'low'])
const confidence = zod.enum(['definite', 'needs_review', 'agentic'])
const agentConfidence = zod.enum(['high', 'medium', 'low'])

function locationSchema<TPath extends zod.ZodTypeAny>(file: TPath) {
  return zod.object({file, line: positiveInteger.optional(), column: positiveInteger.optional()}).strict()
}

function findingShape<TPath extends zod.ZodTypeAny>(file: TPath) {
  const location = locationSchema(file)
  return {
    code: identity,
    severity,
    points: zod.number().finite(),
    confidence: confidence.optional(),
    title: nonemptyText,
    message: nonemptyText,
    location,
    evidence: zod.array(zod.object({location, quote: text.optional()}).strict()),
    snippet: text.optional(),
    fix: zod.object({automated: zod.boolean(), description: nonemptyText, guide: text.optional()}).strict(),
    detection_evidence: zod.array(text).optional(),
    agent_confidence: agentConfidence.optional(),
    agent_reasoning: text.optional(),
  }
}

export const AppDoctorFindingInputSchema = zod
  .object({...findingShape(inputEvidencePath), key: SemanticFindingKeySchema.optional()})
  .strict()
export const AppDoctorFindingSchema = zod
  .object({...findingShape(storedEvidencePath), key: AppDoctorFindingKeySchema, fingerprint: digest})
  .strict()

export const AppDoctorExecutionStatusSchema = zod.enum([
  'executed',
  'not_applicable',
  'unsupported_framework',
  'unresolved',
])
const reason = zod
  .object({
    code: zod.enum([
      'capability_absent',
      'no_relevant_files',
      'unsupported_framework',
      'unsupported_language',
      'parser_unavailable',
      'agent_investigation_required',
      'not_reported',
      'input_rejected',
    ]),
    message: nonemptyText,
  })
  .strict()
const staticAnalysisMode = zod.enum(['regex', 'structured_config', 'ast'])

function executionShape<TPath extends zod.ZodTypeAny>(path: TPath) {
  return {
    status: AppDoctorExecutionStatusSchema,
    inspected_files: zod.array(path),
    reason: reason.optional(),
    guidance: nonemptyText.optional(),
  }
}

function staticShape<TPath extends zod.ZodTypeAny>(path: TPath) {
  return {
    mode: zod.literal('static'),
    required: zod.boolean(),
    applicable: zod.boolean(),
    implementations: zod
      .array(
        zod
          .object({
            id: identity,
            analysis_mode: staticAnalysisMode,
            status: AppDoctorExecutionStatusSchema,
            inspected_files: zod.array(path),
            findings: count,
            reason: reason.optional(),
          })
          .strict(),
      )
      .min(1),
    execution: zod.object({...executionShape(path), analysis_mode: staticAnalysisMode}).strict(),
    coverage: zod
      .object({
        files_scanned: count,
        files_skipped: zod.array(
          zod
            .object({
              path,
              reason: zod.enum(['too_large', 'unreadable']),
              size_bytes: count.optional(),
              detail: text.optional(),
            })
            .strict(),
        ),
        unsupported_languages: zod.array(zod.object({name: identity, files: zod.array(path)}).strict()),
        gaps: zod.array(
          zod
            .object({
              code: zod.enum(['skipped_file', 'unsupported_language', 'unresolved_check']),
              message: nonemptyText,
              check_id: checkId.optional(),
              file: path.optional(),
            })
            .strict(),
        ),
      })
      .strict(),
  }
}

function agentShape<TPath extends zod.ZodTypeAny>(path: TPath) {
  return {
    mode: zod.literal('agent'),
    // The hash describes this exact prompt, so a secret-bearing prompt is rejected rather than rewritten.
    prompt: nonemptyText.refine((value) => redactText(value) === value, 'must not contain secret-like values'),
    prompt_hash: digest,
    execution: zod
      .object({...executionShape(path), analysis_mode: zod.literal('agent'), guidance: nonemptyText})
      .strict(),
  }
}

const commonInputShape = {
  configuration_identity: configurationIdentity,
  scope_identity: digest,
  check_id: checkId,
  check_version: positiveInteger,
  scope: AppDoctorScopeDescriptorSchema,
  produced_at: utcTimestamp,
  engine: zod.object({name: zod.literal(ENGINE_NAME), version: identity, ruleset: identity}).strict(),
}
const commonStoredShape = {
  ...commonInputShape,
  schema_version: zod.literal(APP_DOCTOR_RESULT_SCHEMA_VERSION),
  diagnostic_paths: zod.literal(APP_DOCTOR_DIAGNOSTIC_PATHS),
}
const inputFindings = zod.array(AppDoctorFindingInputSchema)
const storedFindings = zod.array(AppDoctorFindingSchema)

export const AppDoctorResultInputSchema = zod.discriminatedUnion('mode', [
  zod.object({...commonInputShape, ...staticShape(inputEvidencePath), findings: inputFindings}).strict(),
  zod.object({...commonInputShape, ...agentShape(inputEvidencePath), findings: inputFindings}).strict(),
])
export const AppDoctorResultSchema = zod.discriminatedUnion('mode', [
  zod.object({...commonStoredShape, ...staticShape(storedEvidencePath), findings: storedFindings}).strict(),
  zod.object({...commonStoredShape, ...agentShape(storedEvidencePath), findings: storedFindings}).strict(),
])

export type AppDoctorResultOwner = zod.infer<typeof AppDoctorResultOwnerSchema>
export type AppDoctorFindingKey = zod.infer<typeof AppDoctorFindingKeySchema>
export type AppDoctorFindingInput = zod.infer<typeof AppDoctorFindingInputSchema>
export type AppDoctorFinding = zod.infer<typeof AppDoctorFindingSchema>
export type AppDoctorResultInput = zod.infer<typeof AppDoctorResultInputSchema>
export type AppDoctorStaticResultInput = Extract<AppDoctorResultInput, {mode: 'static'}>
export type AppDoctorAgentResultInput = Extract<AppDoctorResultInput, {mode: 'agent'}>
export type AppDoctorResult = zod.infer<typeof AppDoctorResultSchema>
export type AppDoctorStaticResult = Extract<AppDoctorResult, {mode: 'static'}>
export type AppDoctorAgentResult = Extract<AppDoctorResult, {mode: 'agent'}>
export type AppDoctorExecutionStatus = zod.infer<typeof AppDoctorExecutionStatusSchema>
