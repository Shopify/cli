import {findingFingerprint, sha256} from '../../trace/index.js'
import type {TraceFinding, TraceV2} from '../../types.js'

const inputHash = `sha256:${'a'.repeat(64)}`
const privateFileHash = `sha256:${'b'.repeat(64)}`
// Valid-shape placeholders make the object easy to declare; every integrity
// value below is overwritten from the current helper before export.
const deterministicFingerprint = `sha256:${'1'.repeat(64)}`
const agentFingerprint = `sha256:${'2'.repeat(64)}`
const externalFingerprint = `sha256:${'3'.repeat(64)}`
const agentPromptHash = `sha256:${'4'.repeat(64)}`
const unresolvedPromptHash = `sha256:${'5'.repeat(64)}`

const suppression = {
  id: 'accepted-migration-risk',
  finding_fingerprint: deterministicFingerprint,
  justification: 'Accepted until migration finishes',
  provenance: {
    source: 'human' as const,
    actor: 'LEAK_ACTOR@example.com',
    created_at: '2026-08-31T11:00:00.000Z',
  },
}

const traceWithLeakageSentinels = {
  schema_version: 2,
  engine: {
    name: 'shopify-app-doctor',
    version: '0.1.0',
    ruleset: 'app-doctor-rules@0.1.0',
  },
  generated_at: '2026-08-31T10:00:00.000Z',
  project: {
    commit: 'LEAK_COMMIT_SHA_0123456789abcdef',
    dirty: true,
    input_hash: inputHash,
    input_hashes: {'web/app/routes/private.ts': privateFileHash},
  },
  detection: {
    framework: 'react_router',
    surface: 'mixed',
    languages: [
      {name: 'typescript', support: 'supported', files: ['web/app/routes/private.ts', 'web/package.json']},
      {name: 'liquid', support: 'supported', files: ['extensions/private.liquid']},
    ],
  },
  // Coverage is incomplete and a required check is unresolved, so validateTrace requires null.
  score: null,
  findings: [
    {
      fingerprint: deterministicFingerprint,
      source: 'deterministic',
      rule_id: 'KNOWN_CVE_IN_DEPENDENCY',
      rule_version: 2,
      severity: 'high',
      title: 'Vulnerable package lodash (CVE-2026-0001)',
      message: 'LEAK_MESSAGE_DEPENDENCY_CHAIN',
      location: {file: 'web/package.json', line: 12},
      evidence: [{location: {file: 'web/package.json', line: 12}, quote: 'LEAK_EVIDENCE_QUOTE'}],
      snippet: 'LEAK_CODE_SNIPPET',
      fix: {automated: false, guide: 'https://example.com/private-fix', description: 'LEAK_FIX_DESCRIPTION'},
      suppressed: true,
      suppression,
    },
    {
      fingerprint: agentFingerprint,
      source: 'agent',
      check_id: 'MISSING_AUTHORIZATION_CHECK',
      check_version: 3,
      prompt_hash: agentPromptHash,
      severity: 'medium',
      title: 'Authorization check is missing',
      message: 'LEAK_AGENT_MESSAGE',
      location: {file: 'web/app/routes/private.ts', line: 27, column: 3},
      evidence: [{location: {file: 'web/app/routes/private.ts', line: 27}, quote: 'LEAK_AGENT_EVIDENCE'}],
      snippet: 'LEAK_AGENT_SNIPPET',
      fix: {automated: false, description: 'LEAK_AGENT_FIX'},
      suppressed: false,
      future_finding_field: 'LEAK_FUTURE_FINDING',
    },
    {
      fingerprint: externalFingerprint,
      source: 'external',
      rule_id: 'EXTERNAL_SAST_001',
      rule_version: 1,
      severity: 'low',
      title: 'External scanner finding',
      message: 'LEAK_EXTERNAL_MESSAGE',
      location: {file: 'extensions/private.liquid', line: 4},
      evidence: [],
      fix: {automated: false, description: 'LEAK_EXTERNAL_FIX'},
      suppressed: false,
    },
  ],
  checks_executed: [
    {
      id: 'KNOWN_CVE_IN_DEPENDENCY',
      version: 2,
      kind: 'deterministic',
      status: 'executed',
      required: true,
      applicable: true,
      languages: ['typescript'],
      framework: 'react_router',
      surface: 'mixed',
      inspected_files: ['web/package.json'],
      findings: 1,
      analysis_mode: 'audit',
      prompt: 'LEAK_DETERMINISTIC_PROMPT',
      guidance: 'LEAK_DETERMINISTIC_GUIDANCE',
      implementations: [
        {
          id: 'npm-audit',
          analysis_mode: 'audit',
          status: 'executed',
          inspected_files: ['web/package.json'],
          findings: 1,
        },
      ],
      future_check_field: 'LEAK_FUTURE_CHECK',
    },
    {
      id: 'MISSING_AUTHORIZATION_CHECK',
      version: 3,
      kind: 'agent',
      status: 'executed',
      required: false,
      applicable: true,
      languages: ['typescript'],
      framework: 'react_router',
      surface: 'mixed',
      inspected_files: ['web/app/routes/private.ts'],
      findings: 1,
      analysis_mode: 'agent',
      prompt: 'LEAK_AGENT_PROMPT',
      prompt_hash: agentPromptHash,
      guidance: 'LEAK_AGENT_GUIDANCE',
    },
    {
      id: 'EXTERNAL_SAST_001',
      version: 1,
      kind: 'external',
      status: 'executed',
      required: false,
      applicable: true,
      languages: ['liquid'],
      framework: 'react_router',
      surface: 'mixed',
      inspected_files: [],
      findings: 1,
      analysis_mode: 'external',
    },
    {
      id: 'NO_RELEVANT_CHECK',
      version: 1,
      kind: 'deterministic',
      status: 'not_applicable',
      required: false,
      applicable: false,
      languages: ['typescript'],
      framework: 'react_router',
      surface: 'mixed',
      inspected_files: [],
      findings: 0,
      analysis_mode: 'regex',
      reason: {code: 'no_relevant_files', message: 'LEAK_REASON_MESSAGE'},
    },
    {
      id: 'UNREPORTED_AGENT_CHECK',
      version: 1,
      kind: 'agent',
      status: 'unresolved',
      required: true,
      applicable: true,
      languages: ['typescript'],
      framework: 'react_router',
      surface: 'mixed',
      inspected_files: [],
      findings: 0,
      analysis_mode: 'agent',
      reason: {code: 'not_reported', message: 'LEAK_UNRESOLVED_REASON'},
      prompt: 'LEAK_UNRESOLVED_PROMPT',
      prompt_hash: unresolvedPromptHash,
      guidance: 'LEAK_UNRESOLVED_GUIDANCE',
    },
  ],
  suppressions: [suppression],
  coverage: {
    files_scanned: 3,
    files_skipped: [
      {path: 'private/too-large.js', reason: 'too_large', size_bytes: 6_000_000},
      {path: 'private/unreadable.js', reason: 'unreadable', detail: 'LEAK_SKIPPED_DETAIL'},
      {path: 'private/unreadable-two.js', reason: 'unreadable'},
    ],
    complete: false,
    gaps: [
      {code: 'skipped_file', message: 'LEAK_GAP_MESSAGE', file: 'private/unreadable.js'},
      {code: 'unresolved_check', check_id: 'UNREPORTED_AGENT_CHECK', message: 'LEAK_UNRESOLVED_GAP'},
    ],
  },
  future_root_field: 'LEAK_FUTURE_ROOT',
}

function computedFindingFingerprint(finding: TraceFinding): string {
  return findingFingerprint({
    source: finding.source,
    ...(finding.source === 'agent'
      ? {
          check_id: finding.check_id!,
          check_version: finding.check_version!,
          prompt_hash: finding.prompt_hash!,
        }
      : {rule_id: finding.rule_id!, rule_version: finding.rule_version!}),
    severity: finding.severity,
    title: finding.title,
    message: finding.message,
    location: finding.location,
    evidence: finding.evidence,
    ...(finding.snippet === undefined ? {} : {snippet: finding.snippet}),
    fix: finding.fix,
  })
}

// Compute every integrity field from the final semantic inputs. Unknown-field
// sentinels are already present before the unsigned trace digest is calculated.
const unsignedTrace = traceWithLeakageSentinels as unknown as Omit<TraceV2, 'attestation'>
const agentCheck = unsignedTrace.checks_executed[1]!
const unresolvedCheck = unsignedTrace.checks_executed[4]!
agentCheck.prompt_hash = sha256(agentCheck.prompt!)
unresolvedCheck.prompt_hash = sha256(unresolvedCheck.prompt!)
unsignedTrace.findings[1]!.prompt_hash = agentCheck.prompt_hash
for (const finding of unsignedTrace.findings) finding.fingerprint = computedFindingFingerprint(finding)
suppression.finding_fingerprint = unsignedTrace.findings[0]!.fingerprint

export const submissionTraceHashes = {
  deterministicFingerprint: unsignedTrace.findings[0]!.fingerprint,
  agentFingerprint: unsignedTrace.findings[1]!.fingerprint,
  externalFingerprint: unsignedTrace.findings[2]!.fingerprint,
  agentPromptHash: agentCheck.prompt_hash,
  unresolvedPromptHash: unresolvedCheck.prompt_hash,
  traceDigest: sha256(unsignedTrace),
} as const

export const submissionTraceFixture = {
  ...unsignedTrace,
  attestation: {digest: submissionTraceHashes.traceDigest, signed: false},
} as TraceV2
