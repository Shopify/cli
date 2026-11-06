import {suppressedFindingsView} from './security-suppressions-output.js'
import {combineFindings} from './app-security-engine/index.js'
import {describe, expect, test} from 'vitest'
import type {
  AgentFindingsDocument,
  DeterministicFindingsDocument,
  StoredCheck,
  SuppressionEntry,
} from './app-security-engine/index.js'

const snapshot = {
  title: 'Missing mandatory GDPR compliance webhooks',
  severity: 'medium',
  description: 'Detects missing compliance webhook subscriptions.',
  current_version: 1,
} as const

const check = (overrides: Partial<StoredCheck> = {}): StoredCheck => ({
  id: 'MISSING_COMPLIANCE_WEBHOOKS',
  version: 1,
  status: 'executed',
  snapshot,
  findings: [{location: {file: 'shopify.app.toml'}, message: 'Compliance webhooks are missing.', evidence: []}],
  ...overrides,
})

const deterministic = (checks: StoredCheck[]): DeterministicFindingsDocument => ({
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '1.0.0', ruleset: 'app-security-rules@1.0.0'},
  generated_at: '2026-09-01T10:00:00.000Z',
  detection: {framework: 'none', surface: 'config_only', languages: []},
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks,
})

const agent = (checks: StoredCheck[]): AgentFindingsDocument => ({
  schema_version: 1,
  source: 'agent',
  engine: {name: 'shopify-app-security', version: '1.0.0'},
  generated_at: '2026-09-01T11:00:00.000Z',
  scope: {include_dirs: [], excludes: [], no_git_ignore: false},
  checks,
})

const entry: SuppressionEntry = {
  source: 'deterministic',
  check: 'MISSING_COMPLIANCE_WEBHOOKS',
  kind: 'accepted-risk',
  path: 'shopify.app.toml',
  reason: 'Development configuration only.',
  configurations: ['shopify.app.toml'],
}

function view(
  documents: {deterministic: DeterministicFindingsDocument; agent?: AgentFindingsDocument},
  entries = [entry],
) {
  const {checks, suppressions} = combineFindings({
    deterministic: documents.deterministic,
    agent: documents.agent ?? null,
    suppressions: {entries, resultsKey: 'shopify.app'},
  })
  return suppressedFindingsView(checks, suppressions)
}

describe('suppressedFindingsView', () => {
  test('shows the file alone for a finding without a line', () => {
    expect(view({deterministic: deterministic([check()])})).toEqual({
      headline: '1 finding suppressed.',
      counts: '0 active · 1 suppressed',
      sections: [
        {
          title: 'Medium · MISSING_COMPLIANCE_WEBHOOKS · 0 active · 1 suppressed',
          body: {
            list: {
              items: [
                [
                  {filePath: 'shopify.app.toml'},
                  {subdued: '· deterministic · accepted risk · suppressions[0]'},
                  '\nDevelopment configuration only.',
                ],
              ],
            },
          },
        },
        {
          title: 'Entries in shopify.app-security.json',
          body: {
            list: {
              items: [
                [
                  {subdued: 'suppressions[0]:'},
                  'deterministic MISSING_COMPLIANCE_WEBHOOKS in',
                  {filePath: 'shopify.app.toml'},
                  {subdued: '· matches 1 finding'},
                ],
              ],
            },
          },
        },
      ],
    })
  })

  test('is undefined when no finding is suppressed', () => {
    expect(view({deterministic: deterministic([check()])}, [])).toBeUndefined()
    expect(view({deterministic: deterministic([check({findings: []})])})).toBeUndefined()
  })

  test("counts an entry's superseded findings, which the list leaves out", () => {
    const superseded = check({id: 'CREDENTIAL_LOG_LEAKAGE', snapshot: {...snapshot, severity: 'high'}})
    const agentChecks = [
      check({
        id: 'CREDENTIAL_LOG_LEAKAGE',
        snapshot: {...snapshot, severity: 'high', precedence: 'prefer-agent'},
        findings: [
          {
            location: {file: 'app/routes/orders.tsx', line: 4},
            message: 'The token is logged.',
            evidence: [],
            suppression: {justification: 'A placeholder token.'},
          },
        ],
      }),
    ]
    const supersededEntry = {...entry, check: 'CREDENTIAL_LOG_LEAKAGE'}

    const result = view({deterministic: deterministic([superseded]), agent: agent(agentChecks)}, [supersededEntry])

    expect(result?.counts).toBe('0 active · 1 suppressed')
    expect(result?.sections.map((section) => section.title)).toEqual([
      'High · CREDENTIAL_LOG_LEAKAGE · 0 active · 1 suppressed',
      'Entries in shopify.app-security.json',
    ])
    expect(JSON.stringify(result?.sections[0])).toContain('· agent · suppressed by the agent')
    expect(JSON.stringify(result?.sections[1])).toContain('· matches 1 finding')
  })
})
