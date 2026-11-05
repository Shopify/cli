import {suppressedFindingsView, unappliedEntriesView} from './security-suppressions-output.js'
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

describe('unappliedEntriesView', () => {
  const secret = (file: string, line: number) => ({
    location: {file, line},
    message: 'A Shopify access token is committed.',
    evidence: [],
    code_excerpt: [{line, text: 'const token = "shpa[REDACTED:38]"'}],
  })
  const secretCheck = check({
    id: 'COMMITTED_SECRET',
    snapshot: {...snapshot, severity: 'high'},
    findings: [secret('app/routes/session.ts', 3), secret('test/fixtures/a.ts', 1), secret('test/fixtures/a.ts', 7)],
  })
  const secretEntry: SuppressionEntry = {
    ...entry,
    check: 'COMMITTED_SECRET',
    kind: 'false-positive',
    path: 'app/routes/session.ts',
    code: 'shpa[REDACTED:38]',
    reason: 'A fake token for the session tests.',
  }

  function unapplied(entries: SuppressionEntry[], missingPaths: string[] = []) {
    const {suppressions} = combineFindings({
      deterministic: deterministic([check(), secretCheck]),
      agent: null,
      suppressions: {entries, resultsKey: 'shopify.app', missingPaths},
    })
    return unappliedEntriesView(suppressions)
  }

  test('lists the stale entries, then the ambiguous ones, then counts the not-evaluated ones with their reasons', () => {
    const view = unapplied(
      [
        // Three findings at other paths hold this code, so it names no likely path.
        {...secretEntry, path: 'app/routes/old-session.ts', code: 'const token'},
        {...secretEntry, path: 'test/fixtures/a.ts'},
        {...entry, path: 'app/removed.ts'},
        {...entry, source: 'agent', check: 'SCOPE_OVER_REQUEST'},
        {...entry, configurations: ['shopify.app.staging.toml']},
      ],
      ['app/routes/old-session.ts', 'app/removed.ts'],
    )

    expect(view).toEqual({
      headline: '3 entries in shopify.app-security.json suppress nothing.',
      needsChange: true,
      sections: [
        {
          title: 'Stale entries in shopify.app-security.json',
          body: {
            list: {
              items: [
                [
                  {subdued: 'suppressions[0]:'},
                  'deterministic COMMITTED_SECRET in',
                  {filePath: 'app/routes/old-session.ts'},
                  {subdued: '· false positive'},
                  '\nA fake token for the session tests.',
                ],
                [
                  {subdued: 'suppressions[2]:'},
                  'deterministic MISSING_COMPLIANCE_WEBHOOKS in',
                  {filePath: 'app/removed.ts'},
                  {subdued: '· accepted risk'},
                  '\nDevelopment configuration only.',
                ],
              ],
            },
          },
        },
        {body: 'These entries match no finding. Remove each entry, or update it to match the code.'},
        {
          title: 'Ambiguous entries in shopify.app-security.json',
          body: {
            list: {
              items: [
                [
                  {subdued: 'suppressions[1]:'},
                  'deterministic COMMITTED_SECRET in',
                  {filePath: 'test/fixtures/a.ts'},
                  {subdued: '· matches 2 findings'},
                  '\nAt',
                  {filePath: 'test/fixtures/a.ts:1'},
                  {char: ','},
                  {filePath: 'test/fixtures/a.ts:7'},
                ],
              ],
            },
          },
        },
        {body: 'This entry suppresses nothing. Give it a more specific code that matches one finding.'},
        {
          body: {
            subdued:
              'Not evaluated: 2 entries (1 for a check without an executed result, 1 for other app configurations).',
          },
        },
      ],
    })
  })

  test('names the likely new path of a stale entry whose file is gone', () => {
    const moved = {...entry, path: 'shopify.app.development.toml', code: 'Compliance webhooks'}

    const view = unapplied([moved], [moved.path])

    expect(view?.headline).toBe('1 entry in shopify.app-security.json suppresses nothing.')
    expect(view?.sections.slice(0, 2)).toEqual([
      {
        title: 'Stale entries in shopify.app-security.json',
        body: {
          list: {
            items: [
              [
                {subdued: 'suppressions[0]:'},
                'deterministic MISSING_COMPLIANCE_WEBHOOKS in',
                {filePath: 'shopify.app.development.toml'},
                {subdued: '· accepted risk'},
                '\nDevelopment configuration only.',
                '\nMaybe moved to',
                {filePath: 'shopify.app.toml'},
              ],
            ],
          },
        },
      },
      {body: 'This entry matches no finding. Remove it, or update it to match the code.'},
    ])
  })

  test('is an info view with only the count when every entry that applies to nothing is not evaluated', () => {
    expect(unapplied([{...entry, configurations: ['shopify.app.staging.toml']}])).toEqual({
      headline: '1 entry in shopify.app-security.json not evaluated.',
      needsChange: false,
      sections: [{body: {subdued: 'Not evaluated: 1 entry (1 for other app configurations).'}}],
    })
  })

  test('is undefined without entries, and when every entry matched', () => {
    expect(unapplied([])).toBeUndefined()
    expect(unapplied([entry, secretEntry])).toBeUndefined()
  })
})
