/**
 * Normalisation, redaction, and identity derivation for result findings.
 *
 * Diagnostic keys are content digests over redacted, path-normalised finding
 * data, so a stored finding can be re-derived and compared. Fingerprints bind a
 * key to the owning configuration, scope, and check but deliberately exclude
 * the result mode so static and agent findings about the same thing collide.
 */
import {AppDoctorResultError} from './error.js'
import {
  AppDoctorFindingKeySchema,
  AppDoctorResultInputSchema,
  AppDoctorResultOwnerSchema,
  FINDING_IDENTITY_VERSION,
} from './schema.js'
import {toPortablePath} from './scope.js'
import {redactText} from '../rules/secret-rules.js'
import {canonicalJson, sha256} from '../trace/index.js'
import type {
  AppDoctorAgentResultInput,
  AppDoctorFinding,
  AppDoctorFindingInput,
  AppDoctorFindingKey,
  AppDoctorResultInput,
  AppDoctorResultOwner,
  AppDoctorStaticResultInput,
} from './schema.js'

const DIAGNOSTIC_KEY_DOMAIN = `shopify-app-doctor/diagnostic/v${FINDING_IDENTITY_VERSION}`
const FINGERPRINT_DOMAIN = `shopify-app-doctor/finding/v${FINDING_IDENTITY_VERSION}`

const optionalRedacted = <TKey extends string>(key: TKey, value: string | undefined) =>
  value === undefined ? {} : ({[key]: redactText(value)} as Record<TKey, string>)

type FindingLocation = AppDoctorFindingInput['location']
const normalizeLocation = (location: FindingLocation): FindingLocation => ({
  ...location,
  file: toPortablePath(location.file),
})

const normalizeReason = <TReason extends {message: string}>(reason: TReason): TReason => ({
  ...reason,
  message: redactText(reason.message),
})

/** Apply path normalisation and prose redaction to one finding, preserving everything else. */
function normalizeFinding<TFinding extends AppDoctorFindingInput>(finding: TFinding): TFinding {
  return {
    ...finding,
    title: redactText(finding.title),
    message: redactText(finding.message),
    location: normalizeLocation(finding.location),
    evidence: finding.evidence.map((item) => ({
      ...item,
      location: normalizeLocation(item.location),
      ...optionalRedacted('quote', item.quote),
    })),
    ...optionalRedacted('snippet', finding.snippet),
    fix: {
      ...finding.fix,
      description: redactText(finding.fix.description),
      ...optionalRedacted('guide', finding.fix.guide),
    },
    ...(finding.detection_evidence === undefined
      ? {}
      : {detection_evidence: finding.detection_evidence.map(redactText)}),
    ...optionalRedacted('agent_reasoning', finding.agent_reasoning),
  }
}

function normalizeExecution<TExecution extends AppDoctorResultInput['execution']>(execution: TExecution): TExecution {
  return {
    ...execution,
    inspected_files: execution.inspected_files.map(toPortablePath),
    ...(execution.reason === undefined ? {} : {reason: normalizeReason(execution.reason)}),
    ...optionalRedacted('guidance', execution.guidance),
  }
}

function normalizeStaticInput(input: AppDoctorStaticResultInput): AppDoctorStaticResultInput {
  return {
    ...input,
    implementations: input.implementations.map((implementation) => ({
      ...implementation,
      inspected_files: implementation.inspected_files.map(toPortablePath),
      ...(implementation.reason === undefined ? {} : {reason: normalizeReason(implementation.reason)}),
    })),
    execution: normalizeExecution(input.execution),
    coverage: {
      ...input.coverage,
      files_skipped: input.coverage.files_skipped.map((skipped) => ({
        ...skipped,
        path: toPortablePath(skipped.path),
        ...optionalRedacted('detail', skipped.detail),
      })),
      unsupported_languages: input.coverage.unsupported_languages.map((language) => ({
        ...language,
        files: language.files.map(toPortablePath),
      })),
      gaps: input.coverage.gaps.map((gap) => ({
        ...gap,
        message: redactText(gap.message),
        ...(gap.file === undefined ? {} : {file: toPortablePath(gap.file)}),
      })),
    },
    findings: input.findings.map(normalizeFinding),
  }
}

function normalizeAgentInput(input: AppDoctorAgentResultInput): AppDoctorAgentResultInput {
  return {
    ...input,
    execution: normalizeExecution(input.execution),
    findings: input.findings.map(normalizeFinding),
  }
}

/**
 * Normalise diagnostic paths and redact prose. Callers must have applied the
 * JSON preflight and input schema first; the normalised value is validated
 * again so redaction can never produce an invalid result.
 */
export function normalizeResultInput(input: AppDoctorResultInput): AppDoctorResultInput {
  const normalized = input.mode === 'static' ? normalizeStaticInput(input) : normalizeAgentInput(input)
  const parsed = AppDoctorResultInputSchema.safeParse(normalized)
  if (!parsed.success) throw new AppDoctorResultError('App Doctor result input is invalid after normalization.')
  return parsed.data
}

const exactLocation = (location: FindingLocation) => ({
  file: location.file,
  line: location.line ?? null,
  column: location.column ?? null,
})

/** The finding fields that participate in a diagnostic key; nothing else influences it. */
export type DiagnosticFindingContent = Pick<
  AppDoctorFindingInput,
  'title' | 'message' | 'location' | 'evidence' | 'snippet' | 'fix' | 'detection_evidence'
>

/**
 * Derive the versioned diagnostic key. Only diagnostic content participates;
 * absent optional fields are encoded as `null` so an explicit empty string or
 * empty array stays distinct from omission.
 */
export function diagnosticFindingKey(finding: DiagnosticFindingContent): AppDoctorFindingKey {
  const payload = {
    title: finding.title,
    message: finding.message,
    location: exactLocation(finding.location),
    evidence: finding.evidence.map((item) => ({location: exactLocation(item.location), quote: item.quote ?? null})),
    snippet: finding.snippet ?? null,
    fix: {automated: finding.fix.automated, description: finding.fix.description, guide: finding.fix.guide ?? null},
    detection_evidence: finding.detection_evidence ?? null,
  }
  return {namespace: 'diagnostic-v1', value: sha256(canonicalJson([DIAGNOSTIC_KEY_DOMAIN, payload]))}
}

export interface AppDoctorFindingIdentity {
  configurationIdentity: string
  scopeIdentity: string
  code: string
  key: AppDoctorFindingKey
}

/**
 * Compute the trusted fingerprint for a finding identity. Mode is excluded on
 * purpose. Throws `AppDoctorResultError` for invalid identity components.
 */
export function computeAppDoctorFindingFingerprint(identity: AppDoctorFindingIdentity): string {
  const owner = AppDoctorResultOwnerSchema.omit({mode: true}).safeParse({
    configuration_identity: identity.configurationIdentity,
    scope_identity: identity.scopeIdentity,
    check_id: identity.code,
  })
  const key = AppDoctorFindingKeySchema.safeParse(identity.key)
  if (!owner.success || !key.success) throw new AppDoctorResultError('Invalid App Doctor finding identity.')
  return sha256(
    canonicalJson([
      FINGERPRINT_DOMAIN,
      owner.data.configuration_identity,
      owner.data.scope_identity,
      owner.data.check_id,
      key.data.namespace,
      key.data.value,
    ]),
  )
}

/** The owner fields that bind a finding's fingerprint; `mode` is deliberately absent. */
export type AppDoctorFindingOwner = Omit<AppDoctorResultOwner, 'mode'>

/** Build a stored finding from normalised input. Finding code must equal the owning check. */
export function createResultFinding(owner: AppDoctorFindingOwner, finding: AppDoctorFindingInput): AppDoctorFinding {
  if (finding.code !== owner.check_id) {
    throw new AppDoctorResultError('Finding code must equal the owning check ID.')
  }
  const key = finding.key ?? diagnosticFindingKey(finding)
  const fingerprint = computeAppDoctorFindingFingerprint({
    configurationIdentity: owner.configuration_identity,
    scopeIdentity: owner.scope_identity,
    code: finding.code,
    key,
  })
  return {...finding, key, fingerprint}
}
