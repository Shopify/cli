/**
 * Public result contract: build a result from producer input, parse a stored
 * result, serialise, and classify an outcome.
 *
 * The constructor is the only path that derives identities. The parser never
 * repairs: it recomputes what the constructor would have produced and rejects
 * any stored value that disagrees.
 */
import {AppDoctorResultError, describeSchemaIssues} from './error.js'
import {
  computeAppDoctorFindingFingerprint,
  createResultFinding,
  diagnosticFindingKey,
  normalizeResultInput,
} from './identity.js'
import {isBoundedJson} from './json.js'
import {APP_DOCTOR_RESULT_SCHEMA_VERSION, AppDoctorResultInputSchema, AppDoctorResultSchema} from './schema.js'
import {APP_DOCTOR_DIAGNOSTIC_PATHS} from './scope.js'
import {validateAppDoctorResultInvariants} from './validation.js'
import {canonicalJson} from '../trace/index.js'
import type {AppDoctorFinding, AppDoctorFindingInput, AppDoctorResult, AppDoctorResultInput} from './schema.js'

export {AppDoctorResultError} from './error.js'
export {computeAppDoctorFindingFingerprint} from './identity.js'
export type {AppDoctorFindingIdentity} from './identity.js'
export {APP_DOCTOR_RESULT_SCHEMA_VERSION, FINDING_IDENTITY_VERSION} from './schema.js'
export type {
  AppDoctorAgentResult,
  AppDoctorFinding,
  AppDoctorFindingInput,
  AppDoctorFindingKey,
  AppDoctorResult,
  AppDoctorResultInput,
  AppDoctorResultOwner,
  AppDoctorStaticResult,
} from './schema.js'
export {
  APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION,
  formatAppDoctorEvidencePath,
  parseAppDoctorScopeDescriptor,
} from './scope.js'
export type {AppDoctorPathReference, AppDoctorScopeDescriptor, ParseAppDoctorScopeDescriptor} from './scope.js'
export {getAppDoctorResultOutcome} from './validation.js'
export type {AppDoctorResultOutcome} from './validation.js'

export type ParseAppDoctorResult = {ok: true; result: AppDoctorResult} | {ok: false; errors: string[]}

const INVALID_INPUT = 'App Doctor result input is invalid'
const NOT_PLAIN_JSON = 'expected bounded plain JSON data'

function withDerivedFindings(input: AppDoctorResultInput, findings: AppDoctorFinding[]): AppDoctorResult {
  const envelope = {
    schema_version: APP_DOCTOR_RESULT_SCHEMA_VERSION,
    diagnostic_paths: APP_DOCTOR_DIAGNOSTIC_PATHS,
  } as const
  return {...input, ...envelope, findings}
}

/**
 * Build a validated, redacted, detached result from producer input.
 * Throws `AppDoctorResultError` with fixed, non-echoing messages.
 */
export function createAppDoctorResult(input: AppDoctorResultInput): AppDoctorResult {
  if (!isBoundedJson(input)) throw new AppDoctorResultError(INVALID_INPUT, [NOT_PLAIN_JSON])
  const parsedInput = AppDoctorResultInputSchema.safeParse(input)
  if (!parsedInput.success)
    throw new AppDoctorResultError(INVALID_INPUT, describeSchemaIssues(parsedInput.error.issues))

  const normalized = normalizeResultInput(parsedInput.data)
  const owner = {
    configuration_identity: normalized.configuration_identity,
    scope_identity: normalized.scope_identity,
    check_id: normalized.check_id,
  }
  const findings = normalized.findings.map((finding) => createResultFinding(owner, finding))
  // The invariant check below also catches this, but only here is the offending finding still known by position.
  const duplicateIndex = findings.findIndex(
    (finding, index) => findings.findIndex((other) => other.fingerprint === finding.fingerprint) !== index,
  )
  if (duplicateIndex !== -1) {
    throw new AppDoctorResultError(INVALID_INPUT, ['findings: duplicate fingerprint'], {findingIndex: duplicateIndex})
  }

  // Parsing the assembled result again yields a fresh object graph detached from the caller's input.
  const parsedResult = AppDoctorResultSchema.safeParse(withDerivedFindings(normalized, findings))
  if (!parsedResult.success) {
    throw new AppDoctorResultError(INVALID_INPUT, describeSchemaIssues(parsedResult.error.issues))
  }
  const violations = validateAppDoctorResultInvariants(parsedResult.data)
  if (violations.length > 0) throw new AppDoctorResultError(INVALID_INPUT, violations)
  return parsedResult.data
}

function toFindingInput(finding: AppDoctorFinding): AppDoctorFindingInput {
  const {fingerprint: _fingerprint, key, ...content} = finding
  return key.namespace === 'semantic-v1' ? {...content, key} : content
}

function toResultInput(result: AppDoctorResult): AppDoctorResultInput {
  const {schema_version: _schemaVersion, diagnostic_paths: _diagnosticPaths, ...input} = result
  return {...input, findings: result.findings.map(toFindingInput)}
}

/**
 * Recompute derived finding identities and report any stored value that a
 * fresh derivation would not reproduce.
 */
function validateStoredFindings(result: AppDoctorResult): string[] {
  const errors: string[] = []
  result.findings.forEach((finding, index) => {
    if (finding.key.namespace === 'diagnostic-v1' && finding.key.value !== diagnosticFindingKey(finding).value) {
      errors.push(`findings.${index}.key: does not match the diagnostic content`)
    }
    let expectedFingerprint: string | undefined
    try {
      expectedFingerprint = computeAppDoctorFindingFingerprint({
        configurationIdentity: result.configuration_identity,
        scopeIdentity: result.scope_identity,
        code: finding.code,
        key: finding.key,
      })
    } catch (error) {
      if (!(error instanceof AppDoctorResultError)) throw error
    }
    if (finding.fingerprint !== expectedFingerprint) errors.push(`findings.${index}.fingerprint: does not match`)
  })
  return errors
}

/**
 * Validate stored, already-decoded JSON. Establishes internal consistency
 * only; it does not prove authenticity or ownership.
 */
export function parseAppDoctorResult(value: unknown): ParseAppDoctorResult {
  if (!isBoundedJson(value)) return {ok: false, errors: [`result: ${NOT_PLAIN_JSON}`]}
  const parsed = AppDoctorResultSchema.safeParse(value)
  if (!parsed.success) return {ok: false, errors: describeSchemaIssues(parsed.error.issues)}
  const result = parsed.data

  const storedInput = toResultInput(result)
  const normalizationErrors = ['result: contains unredacted or non-normalized values']
  try {
    if (canonicalJson(normalizeResultInput(storedInput)) !== canonicalJson(storedInput)) {
      return {ok: false, errors: normalizationErrors}
    }
  } catch (error) {
    if (!(error instanceof AppDoctorResultError)) throw error
    return {ok: false, errors: normalizationErrors}
  }
  const errors = [...validateStoredFindings(result), ...validateAppDoctorResultInvariants(result)]
  return errors.length === 0 ? {ok: true, result} : {ok: false, errors}
}

/** Canonical JSON with sorted keys and a trailing newline, stable across producers. */
export function serializeAppDoctorResult(result: AppDoctorResult): string {
  return `${canonicalJson(result)}\n`
}
