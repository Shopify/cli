/**
 * Record preparation: turn agent findings documents into agent results.
 *
 * Pure apart from the caller-supplied `producedAt`. Each submission pairs a
 * review token with the document the agent wrote for it; the token carries the
 * owner, scope descriptor, and exact check provenance, so nothing here consults
 * the filesystem, a registry, or a prior scan. Every submission is validated
 * before anything is returned: the caller receives either every entry or every
 * problem, never a partial batch.
 */
import {AppDoctorReviewBindingError, decodeAppDoctorReviewBinding} from './binding.js'
import {AppDoctorAgentFindingsError, parseAppDoctorAgentFindingsDocument} from './findings.js'
import {AppDoctorResultError, createAppDoctorResult, formatAppDoctorEvidencePath} from '../results/index.js'
import {ENGINE_NAME} from '../types.js'
import type {AppDoctorReviewBinding} from './binding.js'
import type {AppDoctorAgentCheck, AppDoctorAgentFindingInput, AppDoctorAgentFindingsDocument} from './findings.js'
import type {Check} from '../checks/index.js'
import type {AppDoctorAgentResultInput, AppDoctorFindingInput, AppDoctorResult} from '../results/schema.js'
import type {AppDoctorScopeDescriptor} from '../results/scope.js'
import type {Severity} from '../types.js'

export type AppDoctorRecordProblemCode =
  | 'invalid_token'
  | 'foreign_configuration'
  | 'invalid_document'
  | 'document_token_mismatch'
  | 'missing_check'
  | 'unknown_check'
  | 'stale_check'
  | 'duplicate_scope'

export interface AppDoctorRecordProblem {
  readonly code: AppDoctorRecordProblemCode
  /** Fixed text plus paths and check IDs; never a token or document value. */
  readonly message: string
  /** Zero-based position of the offending submission in the caller's input. */
  readonly submission: number
  readonly check_id?: string
}

export interface AppDoctorRecordSubmission {
  readonly token: string
  /** The decoded JSON of the findings file, still untrusted. */
  readonly document: unknown
  /** How the document is named in messages, typically its path. */
  readonly documentLabel: string
}

export interface AppDoctorRecordInput {
  readonly configurationIdentity: string
  readonly submissions: ReadonlyArray<AppDoctorRecordSubmission>
  /** The check catalogue shipped with this CLI (`loadChecks()`). */
  readonly checks: ReadonlyMap<string, Check>
  readonly engine: {readonly name: typeof ENGINE_NAME; readonly version: string}
  /** `Date#toISOString()` output supplied by the caller so preparation stays deterministic. */
  readonly producedAt: string
}

export interface AppDoctorRecordScope {
  readonly scope_identity: string
  readonly descriptor: AppDoctorScopeDescriptor
  /** Check IDs in document order. */
  readonly check_ids: ReadonlyArray<string>
}

export type AppDoctorRecordPreparation =
  | {
      readonly status: 'ready'
      /** One agent result per (submission, check), in submission then document order. */
      readonly entries: ReadonlyArray<AppDoctorResult>
      /** One entry per submission, in submission order. */
      readonly scopes: ReadonlyArray<AppDoctorRecordScope>
    }
  | {readonly status: 'rejected'; readonly problems: ReadonlyArray<AppDoctorRecordProblem>}

const REGENERATE_HINT = 'Regenerate the instructions with `shopify app doctor instructions`.'

/**
 * Mirrors the legacy `findingToIssue` table in `checks/index.ts`, keyed by the
 * agent-reported severity. Agent findings never contribute to the score, so the
 * value is descriptive only.
 */
const SEVERITY_POINTS: Record<Severity, number> = {high: -15, medium: -10, low: -5}

/** Fixed guidance for outcomes the agent does not explain itself; `unresolved` carries the agent's own guidance. */
const EXECUTED_GUIDANCE = 'Re-run the agent review after the inspected files change.'
const NOT_APPLICABLE_GUIDANCE = 'Re-run the agent review if the app gains a capability this check covers.'
const NOT_APPLICABLE_REASON = 'The agent reported that the app has no capability this check covers.'

type SubmissionPreparation =
  | {readonly ok: true; readonly scope: AppDoctorRecordScope; readonly entries: AppDoctorResult[]}
  | {readonly ok: false; readonly problems: AppDoctorRecordProblem[]}

/** A step that either yields a value or explains, as a problem, why it could not. */
type Step<T> = {readonly ok: true; readonly value: T} | {readonly ok: false; readonly problem: AppDoctorRecordProblem}

/** Scope-relative POSIX path (already validated by the document schema) → encoded reference path. */
const encodeReferencePath = (scopeRelativePath: string): string =>
  scopeRelativePath.split('/').map(encodeURIComponent).join('/')

const problem = (
  code: AppDoctorRecordProblemCode,
  message: string,
  submission: number,
  checkId?: string,
): AppDoctorRecordProblem => ({code, message, submission, ...(checkId === undefined ? {} : {check_id: checkId})})

function decodeToken(token: string, index: number): Step<AppDoctorReviewBinding> {
  try {
    return {ok: true, value: decodeAppDoctorReviewBinding(token)}
  } catch (error) {
    if (error instanceof AppDoctorReviewBindingError) {
      return {ok: false, problem: problem('invalid_token', error.message, index)}
    }
    throw error
  }
}

function parseDocument(submission: AppDoctorRecordSubmission, index: number): Step<AppDoctorAgentFindingsDocument> {
  try {
    return {ok: true, value: parseAppDoctorAgentFindingsDocument(submission.document)}
  } catch (error) {
    if (error instanceof AppDoctorAgentFindingsError) {
      return {
        ok: false,
        problem: problem('invalid_document', `${submission.documentLabel}: ${error.message}`, index),
      }
    }
    throw error
  }
}

/** The document must answer exactly the checks the token bound: nothing omitted, nothing added. */
function checkSetProblems(
  binding: AppDoctorReviewBinding,
  document: AppDoctorAgentFindingsDocument,
  label: string,
  index: number,
): AppDoctorRecordProblem[] {
  const bound = new Set(binding.checks.map((check) => check.id))
  const answered = new Set(document.checks.map((check) => check.check_id))
  return [
    ...[...bound]
      .filter((id) => !answered.has(id))
      .map((id) => problem('missing_check', `${label}: the document has no entry for check ${id}.`, index, id)),
    ...[...answered]
      .filter((id) => !bound.has(id))
      .map((id) =>
        problem(
          'unknown_check',
          `${label}: the document answers check ${id}, which the review token did not bind.`,
          index,
          id,
        ),
      ),
  ]
}

/** Every bound check must still exist in this CLI with the same version and prompt. */
function staleCheckProblems(
  binding: AppDoctorReviewBinding,
  checks: ReadonlyMap<string, Check>,
  index: number,
): AppDoctorRecordProblem[] {
  return binding.checks
    .filter((bound) => {
      const current = checks.get(bound.id)
      return current === undefined || current.version !== bound.version || current.prompt_hash !== bound.prompt_hash
    })
    .map((bound) =>
      problem(
        'stale_check',
        `Check ${bound.id}: this CLI's check catalogue differs from the one the instructions were generated with. ${REGENERATE_HINT}`,
        index,
        bound.id,
      ),
    )
}

class FindingProjectionError extends Error {
  constructor(readonly findingIndex: number) {
    super('Finding path could not be projected onto the scope.')
    this.name = 'FindingProjectionError'
  }
}

type ResultLocation = AppDoctorFindingInput['location']

function projectLocation(
  scopeDirectory: AppDoctorScopeDescriptor['directory'],
  location: AppDoctorAgentFindingInput['location'],
): ResultLocation {
  return {...location, file: formatAppDoctorEvidencePath(scopeDirectory, encodeReferencePath(location.file))}
}

function toFindingInput(
  check: Check,
  scopeDirectory: AppDoctorScopeDescriptor['directory'],
  finding: AppDoctorAgentFindingInput,
  findingIndex: number,
): AppDoctorFindingInput {
  try {
    return {
      code: check.id,
      severity: finding.severity,
      points: SEVERITY_POINTS[finding.severity],
      // The result contract requires agent findings to carry `agentic` confidence.
      confidence: 'agentic',
      title: finding.title,
      message: finding.message,
      location: projectLocation(scopeDirectory, finding.location),
      evidence: finding.evidence.map((item) => ({...item, location: projectLocation(scopeDirectory, item.location)})),
      ...(finding.snippet === undefined ? {} : {snippet: finding.snippet}),
      fix: {automated: false, ...finding.fix},
      agent_confidence: finding.agent_confidence,
      agent_reasoning: finding.agent_reasoning,
    }
  } catch (error) {
    if (error instanceof AppDoctorResultError) throw new FindingProjectionError(findingIndex)
    throw error
  }
}

function toExecution(
  scopeDirectory: AppDoctorScopeDescriptor['directory'],
  check: AppDoctorAgentCheck,
): AppDoctorAgentResultInput['execution'] {
  const inspectedFiles = check.inspected_files.map((file) =>
    formatAppDoctorEvidencePath(scopeDirectory, encodeReferencePath(file)),
  )
  switch (check.outcome) {
    case 'clean':
    case 'findings':
      return {status: 'executed', analysis_mode: 'agent', inspected_files: inspectedFiles, guidance: EXECUTED_GUIDANCE}
    case 'not_applicable':
      return {
        status: 'not_applicable',
        analysis_mode: 'agent',
        inspected_files: inspectedFiles,
        reason: {code: 'capability_absent', message: NOT_APPLICABLE_REASON},
        guidance: NOT_APPLICABLE_GUIDANCE,
      }
    case 'unresolved':
      if (!hasUnresolvedFields(check)) throw new Error('An unresolved check lost its reason or guidance.')
      return {
        status: 'unresolved',
        analysis_mode: 'agent',
        inspected_files: inspectedFiles,
        reason: {code: 'agent_investigation_required', message: check.reason},
        guidance: check.guidance,
      }
  }
}

/**
 * The document schema requires `reason` and `guidance` whenever the outcome is
 * `unresolved`, but its inferred type keeps them optional; this guard carries
 * the schema's guarantee into the type system.
 */
function hasUnresolvedFields(
  check: AppDoctorAgentCheck,
): check is AppDoctorAgentCheck & {readonly reason: string; readonly guidance: string} {
  return check.reason !== undefined && check.guidance !== undefined
}

function buildEntry(
  input: AppDoctorRecordInput,
  binding: AppDoctorReviewBinding,
  check: Check,
  documentCheck: AppDoctorAgentCheck,
): AppDoctorResult {
  const scopeDirectory = binding.scope.directory
  const resultInput: AppDoctorAgentResultInput = {
    mode: 'agent',
    configuration_identity: binding.configuration_identity,
    scope_identity: binding.scope_identity,
    check_id: check.id,
    check_version: check.version,
    scope: binding.scope,
    produced_at: input.producedAt,
    engine: {
      name: input.engine.name,
      version: input.engine.version,
      // Same convention the legacy trace compiler uses for the ruleset label.
      ruleset: `app-doctor-rules@${input.engine.version}`,
    },
    prompt: check.prompt,
    prompt_hash: check.prompt_hash,
    execution: toExecution(scopeDirectory, documentCheck),
    findings: documentCheck.findings.map((finding, findingIndex) =>
      toFindingInput(check, scopeDirectory, finding, findingIndex),
    ),
  }
  return createAppDoctorResult(resultInput)
}

function buildEntries(
  input: AppDoctorRecordInput,
  binding: AppDoctorReviewBinding,
  document: AppDoctorAgentFindingsDocument,
  label: string,
  index: number,
): SubmissionPreparation {
  const entries: AppDoctorResult[] = []
  const problems: AppDoctorRecordProblem[] = []
  for (const documentCheck of document.checks) {
    const check = input.checks.get(documentCheck.check_id)
    // Membership and staleness were established before entries are built.
    if (check === undefined) continue
    const prefix = `${label}: check ${check.id}`
    // The result contract rejects an executed result with no inspected files too, but its message is fixed
    // text about the contract; checking here first lets the problem name the document field the agent must fix.
    if (documentCheck.outcome !== 'not_applicable' && documentCheck.outcome !== 'unresolved') {
      if (documentCheck.inspected_files.length === 0) {
        problems.push(
          problem(
            'invalid_document',
            `${prefix}: inspected_files must list at least one file when the outcome is \`${documentCheck.outcome}\`.`,
            index,
            check.id,
          ),
        )
        continue
      }
    }
    try {
      entries.push(buildEntry(input, binding, check, documentCheck))
    } catch (error) {
      if (error instanceof FindingProjectionError) {
        problems.push(
          problem(
            'invalid_document',
            `${prefix}: findings[${error.findingIndex}] names a path the evidence contract can't carry.`,
            index,
            check.id,
          ),
        )
      } else if (error instanceof AppDoctorResultError) {
        const where = error.findingIndex === undefined ? prefix : `${prefix}: findings[${error.findingIndex}]`
        problems.push(problem('invalid_document', `${where}: ${error.message}`, index, check.id))
      } else {
        throw error
      }
    }
  }
  if (problems.length > 0) return {ok: false, problems}
  return {
    ok: true,
    scope: {
      scope_identity: binding.scope_identity,
      descriptor: binding.scope,
      check_ids: document.checks.map((check) => check.check_id),
    },
    entries,
  }
}

function prepareSubmission(
  input: AppDoctorRecordInput,
  binding: AppDoctorReviewBinding,
  submission: AppDoctorRecordSubmission,
  index: number,
): SubmissionPreparation {
  if (binding.configuration_identity !== input.configurationIdentity) {
    return {
      ok: false,
      problems: [
        problem(
          'foreign_configuration',
          `The instructions were generated for a different app configuration. ${REGENERATE_HINT}`,
          index,
        ),
      ],
    }
  }
  const parsed = parseDocument(submission, index)
  if (!parsed.ok) return {ok: false, problems: [parsed.problem]}
  const document = parsed.value
  if (document.review !== submission.token) {
    return {
      ok: false,
      problems: [
        problem(
          'document_token_mismatch',
          `${submission.documentLabel}: the document's review token differs from the --review token it was paired with.`,
          index,
        ),
      ],
    }
  }
  const problems = [
    ...checkSetProblems(binding, document, submission.documentLabel, index),
    ...staleCheckProblems(binding, input.checks, index),
  ]
  if (problems.length > 0) return {ok: false, problems}
  return buildEntries(input, binding, document, submission.documentLabel, index)
}

/**
 * Validate every submission and build the agent results they describe. A
 * problem in any submission rejects the whole record; nothing is partial.
 * Every entry carries the caller's `producedAt`, so re-recording is a new
 * review rather than a byte-identical rewrite.
 */
export function prepareAppDoctorRecord(input: AppDoctorRecordInput): AppDoctorRecordPreparation {
  const problems: AppDoctorRecordProblem[] = []
  const entries: AppDoctorResult[] = []
  const scopes: AppDoctorRecordScope[] = []
  const seenScopes = new Set<string>()

  input.submissions.forEach((submission, index) => {
    const decoded = decodeToken(submission.token, index)
    if (!decoded.ok) {
      problems.push(decoded.problem)
      return
    }
    const binding = decoded.value
    if (seenScopes.has(binding.scope_identity)) {
      problems.push(
        problem(
          'duplicate_scope',
          `${submission.documentLabel}: another submission already covers the same review scope.`,
          index,
        ),
      )
    }
    seenScopes.add(binding.scope_identity)

    const prepared = prepareSubmission(input, binding, submission, index)
    if (prepared.ok) {
      entries.push(...prepared.entries)
      scopes.push(prepared.scope)
    } else {
      problems.push(...prepared.problems)
    }
  })

  if (problems.length > 0) return {status: 'rejected', problems}
  return {status: 'ready', entries, scopes}
}
