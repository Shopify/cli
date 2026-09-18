/**
 * Interpretation fixtures. Every export is a factory returning a fresh, fully
 * validated result so tests share no state and need no filesystem.
 *
 * Static and agent findings that should merge use the same semantic key, which
 * gives them the same fingerprint (mode is excluded from fingerprints).
 */
import {CONFIGURATION_IDENTITY, INSPECTED_FILE, engine, scopeDescriptor} from './result-contract.js'
import {createAppDoctorResult} from '../../results/index.js'
import {sha256} from '../../trace/index.js'
import type {
  AppDoctorAgentResult,
  AppDoctorFinding,
  AppDoctorResultInput,
  AppDoctorScopeDescriptor,
  AppDoctorStaticResult,
} from '../../results/index.js'
import type {AppDoctorInterpretedSkippedFile} from '../../interpretation/index.js'
import type {AppDoctorMetadataInventory} from '../../scopes/types.js'
import type {Suppression} from '../../types.js'

export const APP_SCOPE = `sha256:${'a'.repeat(64)}`
export const WEB_SCOPE = `sha256:${'b'.repeat(64)}`
export const LOG_CHECK = 'CREDENTIAL_LOG_LEAKAGE'
export const WEBHOOK_CHECK = 'WEBHOOK_HMAC_UNVERIFIED'
export const PRODUCED_AT = '2026-09-16T12:00:00.000Z'
export const SKIPPED_FILE = 'anchor/0/app/generated/bundle.js'
export const RUBY_FILE = 'anchor/0/app/legacy/server.rb'

type StaticInput = Extract<AppDoctorResultInput, {mode: 'static'}>
type AgentInput = Extract<AppDoctorResultInput, {mode: 'agent'}>
type StaticCoverage = StaticInput['coverage']
type FindingInput = AppDoctorResultInput['findings'][number]

export interface FindingOptions {
  /** Semantic key value; the same key on a static and an agent finding yields one fingerprint. */
  readonly key: string
  readonly points?: number
  readonly severity?: AppDoctorFinding['severity']
  readonly confidence?: 'definite' | 'needs_review'
  readonly title?: string
}

interface OwnerOptions {
  readonly scopeIdentity?: string
  readonly checkId?: string
  readonly checkVersion?: number
  readonly producedAt?: string
  readonly descriptor?: AppDoctorScopeDescriptor
}

export interface StaticResultOptions extends OwnerOptions {
  readonly findings?: ReadonlyArray<FindingOptions>
  readonly coverage?: Partial<Omit<StaticCoverage, 'gaps'>>
  /** Scan-wide gaps; skipped_file and unsupported_language gaps must match `coverage`. */
  readonly gaps?: StaticCoverage['gaps']
}

export interface AgentResultOptions extends OwnerOptions {
  readonly findings?: ReadonlyArray<FindingOptions>
  readonly prompt?: string
}

/** A second descriptor for the app scope, used to show that all observed descriptors are kept. */
export const webDescriptor = (): AppDoctorScopeDescriptor => ({
  ...scopeDescriptor(),
  directory: {base: 'storage_anchor', up: 0, path: 'web'},
})

const findingInput = (checkId: string, options: FindingOptions): FindingInput => ({
  code: checkId,
  key: {namespace: 'semantic-v1', value: options.key},
  severity: options.severity ?? 'high',
  points: options.points ?? -20,
  confidence: options.confidence ?? 'definite',
  title: options.title ?? `Static title for ${options.key}`,
  message: `Static message for ${options.key}.`,
  location: {file: INSPECTED_FILE, line: 12, column: 5},
  evidence: [{location: {file: INSPECTED_FILE, line: 12}, quote: 'console.log(session.accessToken)'}],
  snippet: 'console.log(session.accessToken)',
  fix: {automated: false, description: `Static fix for ${options.key}.`},
})

const skippedFiles = (coverage: StaticResultOptions['coverage']) => coverage?.files_skipped ?? []
const unsupportedLanguages = (coverage: StaticResultOptions['coverage']) => coverage?.unsupported_languages ?? []

const SKIPPED_FILE_MESSAGES: Record<AppDoctorInterpretedSkippedFile['reason'], string> = {
  too_large: 'File exceeded the size limit.',
  unreadable: 'File could not be read.',
}

/** Scan-wide gaps derived from the coverage lists so the result stays internally consistent. */
const derivedGaps = (coverage: StaticResultOptions['coverage']): StaticCoverage['gaps'] => [
  ...skippedFiles(coverage).map((skipped) => ({
    code: 'skipped_file' as const,
    message: SKIPPED_FILE_MESSAGES[skipped.reason],
    file: skipped.path,
  })),
  ...unsupportedLanguages(coverage).map((language) => ({
    code: 'unsupported_language' as const,
    message: `${language.name} sources are not analysed.`,
  })),
]

/** An executed static result with clean coverage unless `coverage` says otherwise. */
export function staticResult(options: StaticResultOptions = {}): AppDoctorStaticResult {
  const checkId = options.checkId ?? LOG_CHECK
  const findings = (options.findings ?? []).map((finding) => findingInput(checkId, finding))
  const input: StaticInput = {
    mode: 'static',
    configuration_identity: CONFIGURATION_IDENTITY,
    scope_identity: options.scopeIdentity ?? APP_SCOPE,
    check_id: checkId,
    check_version: options.checkVersion ?? 3,
    scope: options.descriptor ?? scopeDescriptor(),
    produced_at: options.producedAt ?? PRODUCED_AT,
    engine: engine(),
    required: true,
    applicable: true,
    implementations: [
      {
        id: `${checkId.toLowerCase()}-regex`,
        analysis_mode: 'regex',
        status: 'executed',
        inspected_files: [INSPECTED_FILE],
        findings: findings.length,
      },
    ],
    execution: {status: 'executed', analysis_mode: 'regex', inspected_files: [INSPECTED_FILE]},
    coverage: {
      files_scanned: options.coverage?.files_scanned ?? 2,
      files_skipped: skippedFiles(options.coverage),
      unsupported_languages: unsupportedLanguages(options.coverage),
      gaps: options.gaps ?? derivedGaps(options.coverage),
    },
    findings,
  }
  const result = createAppDoctorResult(input)
  if (result.mode !== 'static') throw new Error('fixture mode')
  return result
}

/** A required static check that could not run, carrying its owner-local `unresolved_check` gap. */
export function unresolvedStaticResult(options: OwnerOptions = {}): AppDoctorStaticResult {
  const checkId = options.checkId ?? LOG_CHECK
  const reason = {code: 'parser_unavailable' as const, message: 'The TypeScript parser is unavailable.'}
  const input: StaticInput = {
    mode: 'static',
    configuration_identity: CONFIGURATION_IDENTITY,
    scope_identity: options.scopeIdentity ?? APP_SCOPE,
    check_id: checkId,
    check_version: options.checkVersion ?? 3,
    scope: options.descriptor ?? scopeDescriptor(),
    produced_at: options.producedAt ?? PRODUCED_AT,
    engine: engine(),
    required: true,
    applicable: true,
    implementations: [
      {
        id: `${checkId.toLowerCase()}-ast`,
        analysis_mode: 'ast',
        status: 'unresolved',
        inspected_files: [],
        findings: 0,
      },
    ],
    execution: {
      status: 'unresolved',
      analysis_mode: 'ast',
      inspected_files: [],
      reason,
      guidance: 'Install the parser and rerun the scan.',
    },
    coverage: {
      files_scanned: 2,
      files_skipped: [],
      unsupported_languages: [],
      gaps: [{code: 'unresolved_check', message: `${checkId} could not run.`, check_id: checkId}],
    },
    findings: [],
  }
  const result = createAppDoctorResult(input)
  if (result.mode !== 'static') throw new Error('fixture mode')
  return result
}

/** An executed agent result. Agent findings are always `agentic` and never score. */
export function agentResult(options: AgentResultOptions = {}): AppDoctorAgentResult {
  const checkId = options.checkId ?? LOG_CHECK
  const prompt = options.prompt ?? `Review every handler for ${checkId}.`
  const input: AgentInput = {
    mode: 'agent',
    configuration_identity: CONFIGURATION_IDENTITY,
    scope_identity: options.scopeIdentity ?? APP_SCOPE,
    check_id: checkId,
    check_version: options.checkVersion ?? 3,
    scope: options.descriptor ?? scopeDescriptor(),
    produced_at: options.producedAt ?? PRODUCED_AT,
    engine: engine(),
    prompt,
    prompt_hash: sha256(prompt),
    execution: {
      status: 'executed',
      analysis_mode: 'agent',
      inspected_files: [INSPECTED_FILE],
      guidance: 'Confirm each handler verifies the request before reading the shop.',
    },
    findings: (options.findings ?? []).map((finding) => ({
      ...findingInput(checkId, finding),
      title: finding.title ?? `Agent title for ${finding.key}`,
      message: `Agent message for ${finding.key}.`,
      fix: {automated: false, description: `Agent fix for ${finding.key}.`},
      confidence: 'agentic',
      agent_confidence: 'high',
      agent_reasoning: 'The handler reads the session token before verifying the request.',
    })),
  }
  const result = createAppDoctorResult(input)
  if (result.mode !== 'agent') throw new Error('fixture mode')
  return result
}

/** An inventory whose only current scope is the app scope, with no retained observations. */
export const inventory = (currentScopes: ReadonlyArray<string> = [APP_SCOPE]): AppDoctorMetadataInventory => ({
  current: currentScopes.map((scopeIdentity) => ({
    scopeIdentity,
    directory: `/ghost/${scopeIdentity.slice('sha256:'.length, 'sha256:'.length + 8)}`,
    reference: {base: 'storage_anchor', up: 0, path: '.'},
    selection: 'implicit_app',
  })),
  retained: [],
})

export const suppressionFor = (fingerprint: string, id = 'sup-1'): Suppression => ({
  id,
  finding_fingerprint: fingerprint,
  justification: `Accepted risk for ${id}.`,
  provenance: {source: 'human', actor: 'reviewer', created_at: PRODUCED_AT},
})
