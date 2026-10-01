import type {DeterministicFindingsDocument} from '../../types.js'

// Every LEAK_* value, path, and future_* field is a sentinel that must never reach the submission payload.
const scanWithLeakageSentinels = {
  schema_version: 1,
  engine: {
    name: 'shopify-app-security',
    version: '0.1.0',
    ruleset: 'app-security-rules@0.1.0',
  },
  generated_at: '2026-08-31T10:00:00.000Z',
  project: {
    commit: 'LEAK_COMMIT_SHA_0123456789abcdef',
    dirty: true,
  },
  detection: {
    framework: 'react_router',
    surface: 'mixed',
    languages: [
      {name: 'typescript', support: 'supported', files: ['web/app/routes/private.ts', 'web/package.json']},
      {name: 'liquid', support: 'supported', files: ['extensions/private.liquid']},
    ],
  },
  findings: [
    {
      rule_id: 'UNSAFE_INNERHTML',
      rule_version: 2,
      severity: 'high',
      title: 'Unsafe HTML assignment',
      message: 'LEAK_DETERMINISTIC_MESSAGE',
      location: {file: 'web/app/routes/private.ts', line: 12},
      evidence: [{location: {file: 'web/app/routes/private.ts', line: 12}, quote: 'LEAK_EVIDENCE_QUOTE'}],
      snippet: 'LEAK_CODE_SNIPPET',
      fix: {automated: false, guide: 'https://example.com/LEAK_FIX_GUIDE', description: 'LEAK_FIX_DESCRIPTION'},
      future_finding_field: 'LEAK_FUTURE_FINDING',
    },
    {
      rule_id: 'CREDENTIAL_LOG_LEAKAGE',
      rule_version: 1,
      severity: 'medium',
      title: 'Credential logged',
      message: 'LEAK_SECOND_MESSAGE',
      location: {file: 'web/app/routes/private.ts', line: 27, column: 3},
      evidence: [],
      fix: {automated: false, description: 'LEAK_SECOND_FIX'},
    },
  ],
  checks_executed: [
    {
      id: 'CREDENTIAL_LOG_LEAKAGE',
      version: 1,
      status: 'executed',
      applicable: true,
      analysis_mode: 'regex',
      findings: 1,
    },
    {
      id: 'LIQUID_UNSAFE_RENDER',
      version: 1,
      status: 'unresolved',
      applicable: true,
      analysis_mode: 'ast',
      findings: 0,
      reason: {code: 'parser_unavailable', message: 'LEAK_UNRESOLVED_REASON'},
    },
    {
      id: 'STATIC_FRAME_ANCESTORS',
      version: 1,
      status: 'not_applicable',
      applicable: false,
      analysis_mode: 'regex',
      findings: 0,
      reason: {code: 'capability_absent', message: 'LEAK_REASON_MESSAGE'},
    },
    {
      id: 'UNSAFE_INNERHTML',
      version: 2,
      status: 'executed',
      applicable: true,
      analysis_mode: 'regex',
      findings: 1,
      future_check_field: 'LEAK_FUTURE_CHECK',
    },
  ],
  coverage: {
    files_scanned: 3,
    files_skipped: [
      {path: 'private/too-large.js', reason: 'too_large', size_bytes: 6_000_000},
      {path: 'private/unreadable.js', reason: 'unreadable', detail: 'LEAK_SKIPPED_DETAIL'},
      {path: 'private/unreadable-two.js', reason: 'unreadable'},
    ],
    gaps: [
      {code: 'skipped_file', message: 'LEAK_GAP_MESSAGE', file: 'private/unreadable.js'},
      {code: 'unresolved_check', check_id: 'LIQUID_UNSAFE_RENDER', message: 'LEAK_UNRESOLVED_GAP'},
    ],
  },
  future_root_field: 'LEAK_FUTURE_ROOT',
}

/** A deterministic-findings.json with leakage sentinels in every field the submission must drop. */
export const submissionScanFixture = scanWithLeakageSentinels as DeterministicFindingsDocument
