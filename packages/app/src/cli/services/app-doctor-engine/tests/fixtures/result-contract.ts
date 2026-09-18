/**
 * Representative result-contract inputs. Every export is a factory returning a
 * fresh object so tests can mutate freely without sharing state.
 */
import {sha256} from '../../trace/index.js'
import type {AppDoctorResultInput, AppDoctorScopeDescriptor} from '../../results/index.js'

export const CONFIGURATION_IDENTITY = 'c'.repeat(32)
export const SCOPE_IDENTITY = `sha256:${'a'.repeat(64)}`
export const CHECK_ID = 'CREDENTIAL_LOG_LEAKAGE'
export const VOLUME_TOKEN = `sha256:${'b'.repeat(64)}`
export const PRODUCED_AT = '2026-09-16T12:00:00.000Z'

export const INSPECTED_FILE = 'anchor/0/app/routes/webhooks.tsx'
export const SECOND_INSPECTED_FILE = 'anchor/0/app/shopify.server.ts'
export const SKIPPED_FILE = 'anchor/0/app/generated/bundle.js'

export const scopeDescriptor = (): AppDoctorScopeDescriptor => ({
  descriptor_version: 1,
  app_directory: {base: 'storage_anchor', up: 0, path: '.'},
  selected_config: {base: 'storage_anchor', up: 0, path: 'shopify.app.toml'},
  directory: {base: 'storage_anchor', up: 0, path: '.'},
  boundary: {app: 'inside', anchor: 'inside'},
  exclusions: {
    semantics: 'literal-file-or-subtree-v1',
    declared_from: 'selected_config_directory',
    entries: [{base: 'storage_anchor', up: 0, path: 'node_modules'}],
  },
})

export const engine = () => ({name: 'shopify-app-doctor' as const, version: '3.90.0', ruleset: 'ruleset-2026-09'})

export const findingInput = (): AppDoctorResultInput['findings'][number] => ({
  code: CHECK_ID,
  severity: 'high',
  points: -20,
  confidence: 'definite',
  title: 'Access token written to logs',
  message: 'The offline access token is passed to console.log.',
  location: {file: INSPECTED_FILE, line: 12, column: 5},
  evidence: [{location: {file: INSPECTED_FILE, line: 12}, quote: 'console.log(session.accessToken)'}],
  snippet: 'console.log(session.accessToken)',
  fix: {automated: false, description: 'Remove the token from the log statement.', guide: 'https://shopify.dev'},
  detection_evidence: ['regex:console-log-token'],
})

export const staticResultInput = (): AppDoctorResultInput => ({
  mode: 'static',
  configuration_identity: CONFIGURATION_IDENTITY,
  scope_identity: SCOPE_IDENTITY,
  check_id: CHECK_ID,
  check_version: 3,
  scope: scopeDescriptor(),
  produced_at: PRODUCED_AT,
  engine: engine(),
  required: true,
  applicable: true,
  implementations: [
    {
      id: 'credential-log-regex',
      analysis_mode: 'regex',
      status: 'executed',
      inspected_files: [INSPECTED_FILE],
      findings: 1,
    },
    {
      id: 'credential-log-ast',
      analysis_mode: 'ast',
      status: 'executed',
      inspected_files: [SECOND_INSPECTED_FILE],
      findings: 0,
    },
  ],
  execution: {
    status: 'executed',
    analysis_mode: 'regex',
    inspected_files: [INSPECTED_FILE, SECOND_INSPECTED_FILE],
  },
  coverage: {
    files_scanned: 2,
    files_skipped: [{path: SKIPPED_FILE, reason: 'too_large', size_bytes: 5_000_000}],
    unsupported_languages: [{name: 'ruby', files: ['anchor/0/app/legacy/server.rb']}],
    gaps: [
      {code: 'skipped_file', message: 'File exceeded the size limit.', file: SKIPPED_FILE},
      {code: 'unsupported_language', message: 'Ruby sources are not analysed.'},
    ],
  },
  findings: [findingInput()],
})

export const AGENT_PROMPT = 'Review every webhook handler for unauthenticated shop lookups.'

export const agentResultInput = (): AppDoctorResultInput => ({
  mode: 'agent',
  configuration_identity: CONFIGURATION_IDENTITY,
  scope_identity: SCOPE_IDENTITY,
  check_id: CHECK_ID,
  check_version: 3,
  scope: scopeDescriptor(),
  produced_at: PRODUCED_AT,
  engine: engine(),
  prompt: AGENT_PROMPT,
  prompt_hash: sha256(AGENT_PROMPT),
  execution: {
    status: 'executed',
    analysis_mode: 'agent',
    inspected_files: [INSPECTED_FILE],
    guidance: 'Confirm each handler verifies the webhook HMAC before reading the shop.',
  },
  findings: [
    {
      ...findingInput(),
      confidence: 'agentic',
      agent_confidence: 'high',
      agent_reasoning: 'The handler reads the session token before verifying the request.',
    },
  ],
})
