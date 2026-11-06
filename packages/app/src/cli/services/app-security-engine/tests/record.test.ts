import {loadChecks, recordAgentFindings, type RecordAgentFindingsOptions} from '../checks/index.js'
import {MAX_EXCERPT_LINE_LENGTH} from '../results/code-excerpt.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {translateFindingsDocument} from '../results/translate.js'
import {ENGINE_NAME, FINDINGS_SCHEMA_VERSION} from '../types.js'
import {describe, expect, test, vi} from 'vitest'
import type {AgentFindingsDocument, AppSecurityScope} from '../types.js'

const options: RecordAgentFindingsOptions = {
  engineVersion: '3.99.0',
  generatedAt: '2026-01-02T03:04:05.000Z',
}

// Composed at runtime so the literal token never appears in the repository.
const FAKE_SHOPIFY_TOKEN = ['shpat', '_', '0123456789abcdef'.repeat(2)].join('')

const tenant = loadChecks().get('MISSING_TENANT_ISOLATION')!

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    check_id: tenant.id,
    check_version: tenant.version,
    file: 'app/routes/orders.tsx',
    line: 12,
    message: 'Orders are loaded without a shop filter',
    evidence: [{file: 'app/routes/orders.tsx', line: 12, quote: 'prisma.order.findMany()'}],
    ...overrides,
  }
}

const scope: AppSecurityScope = {include_dirs: ['../backend'], excludes: ['**/generated'], no_git_ignore: true}

/** Adds the required `scope` to a test document, unless the document says otherwise. */
function withScope(input: unknown): unknown {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? {scope, ...input} : input
}

function recordAccepted(input: unknown): AgentFindingsDocument {
  const result = recordAgentFindings(withScope(input), options)
  if (!result.ok) throw new Error(`Expected the document to be accepted: ${result.errors.join('; ')}`)
  return result.document
}

function recordRejected(document: unknown): string[] {
  const result = recordAgentFindings(withScope(document), options)
  if (result.ok) throw new Error('Expected the document to be rejected')
  return result.errors
}

describe('recordAgentFindings', () => {
  test('accepts a valid document and groups findings under their check', () => {
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [
        {check_id: tenant.id, check_version: tenant.version, status: 'executed'},
        {
          check_id: 'OPEN_REDIRECT',
          check_version: 1,
          status: 'not_applicable',
          reason: {code: 'no_redirects', message: 'The app never redirects'},
        },
      ],
      findings: [
        finding(),
        finding({
          line: 30,
          snippet: 'db.order.delete()',
          confidence: 'high',
          reasoning: 'No session check',
          suppression: {justification: 'Admin-only route'},
        }),
      ],
    })

    expect(document).toMatchObject({
      schema_version: FINDINGS_SCHEMA_VERSION,
      source: 'agent',
      engine: {name: ENGINE_NAME, version: '3.99.0'},
      generated_at: '2026-01-02T03:04:05.000Z',
      scope,
    })
    expect(document.checks.map((check) => [check.id, check.status, check.findings.length])).toEqual([
      [tenant.id, 'executed', 2],
      ['OPEN_REDIRECT', 'not_applicable', 0],
    ])
    expect(document.checks[1]!.reason).toEqual({code: 'no_redirects', message: 'The app never redirects'})
    expect(document.checks[0]!.findings[1]).toEqual({
      location: {file: 'app/routes/orders.tsx', line: 30},
      message: 'Orders are loaded without a shop filter',
      evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}, quote: 'prisma.order.findMany()'}],
      snippet: 'db.order.delete()',
      confidence: 'high',
      reasoning: 'No session check',
      suppression: {justification: 'Admin-only route'},
    })
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('writes the exact document for a check with no findings', () => {
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [
        {
          check_id: 'OPEN_REDIRECT',
          check_version: 2,
          status: 'unresolved',
          reason: {code: 'needs_runtime', message: 'Redirects are built at runtime'},
        },
      ],
    })
    const entry = RULE_CATALOG.find((catalogEntry) => catalogEntry.id === 'OPEN_REDIRECT')!
    const check = loadChecks().get('OPEN_REDIRECT')!

    expect(document).toEqual({
      schema_version: 1,
      source: 'agent',
      engine: {name: 'shopify-app-security', version: '3.99.0'},
      generated_at: '2026-01-02T03:04:05.000Z',
      scope,
      checks: [
        {
          id: 'OPEN_REDIRECT',
          version: 2,
          status: 'unresolved',
          reason: {code: 'needs_runtime', message: 'Redirects are built at runtime'},
          snapshot: {
            title: entry.title,
            severity: check.severity,
            description: entry.description,
            guide: entry.guide,
            docs_url: entry.docsUrl,
            current_version: check.version,
            precedence: 'union',
          },
          findings: [],
        },
      ],
    })
  })

  test('defaults generated_at to the current time', () => {
    const result = recordAgentFindings({schema_version: 1, scope}, {...options, generatedAt: undefined})

    expect(result.ok && Date.parse(result.document.generated_at)).toBeGreaterThan(0)
  })

  test('rejects the whole document and reports every error', () => {
    const errors = recordRejected({
      schema_version: 2,
      checks_executed: [
        {check_id: tenant.id, check_version: 0},
        {check_id: 'OPEN_REDIRECT', check_version: 1, status: 'unresolved'},
      ],
      findings: [finding(), finding({line: 0}), finding({evidence: []})],
    })

    expect(errors).toEqual([
      'schema_version must be 1',
      `checks_executed[0] (${tenant.id}): missing or invalid check_version`,
      'checks_executed[1] (OPEN_REDIRECT): unresolved requires a reason',
      `findings[1] (${tenant.id}): invalid line number: 0`,
      `findings[2] (${tenant.id}): finding requires at least one evidence citation`,
    ])
  })

  test('requires a scope, reports it with the other errors, and records nothing', () => {
    const result = recordAgentFindings({schema_version: 2}, options)

    expect(result).toEqual({ok: false, errors: ['schema_version must be 1', 'scope is required and must be an object']})
  })

  test.each([
    [[], 'scope is required and must be an object'],
    [{excludes: [], no_git_ignore: false}, 'scope.include_dirs must be an array of strings'],
    [{include_dirs: [], excludes: [3], no_git_ignore: false}, 'scope.excludes must be an array of strings'],
    [{include_dirs: [], excludes: [], no_git_ignore: 0}, 'scope.no_git_ignore must be a boolean'],
  ])('rejects the malformed scope %j', (malformedScope, expectedError) => {
    expect(recordAgentFindings({schema_version: 1, scope: malformedScope}, options)).toEqual({
      ok: false,
      errors: [expectedError],
    })
  })

  test('keeps only the known scope keys, with the values exactly as reported', () => {
    const document = recordAccepted({schema_version: 1, scope: {...scope, extra: true}})

    expect(document.scope).toEqual(scope)
  })

  test('redacts secrets in the scope', () => {
    const document = recordAccepted({
      schema_version: 1,
      scope: {include_dirs: [`../${FAKE_SHOPIFY_TOKEN}`], excludes: [FAKE_SHOPIFY_TOKEN], no_git_ignore: false},
    })

    expect(JSON.stringify(document.scope)).not.toContain(FAKE_SHOPIFY_TOKEN)
    expect(document.scope.include_dirs[0]).toMatch(/^\.\.\/.*\[REDACTED/)
  })

  test('rejects a document that is not an object or has malformed arrays', () => {
    expect(recordRejected([])).toEqual(['The findings document must be a JSON object.'])
    expect(recordRejected({schema_version: 1, checks_executed: {}, findings: 'none'})).toEqual([
      'checks_executed must be an array',
      'findings must be an array',
    ])
  })

  test('rejects an unknown check_id in checks_executed and findings', () => {
    const errors = recordRejected({
      schema_version: 1,
      checks_executed: [{check_id: 'NOT_A_CHECK', check_version: 1, status: 'executed'}],
      findings: [finding({check_id: 'ALSO_NOT_A_CHECK'})],
    })

    expect(errors).toEqual([
      'checks_executed[0] (NOT_A_CHECK): unknown check_id',
      'findings[0] (ALSO_NOT_A_CHECK): unknown check_id',
    ])
  })

  test('keeps the claimed check_version even when it differs from the current version', () => {
    const claimedVersion = tenant.version + 4
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [{check_id: tenant.id, check_version: claimedVersion, status: 'executed'}],
      findings: [finding({check_version: claimedVersion})],
    })

    expect(document.checks[0]!.version).toBe(claimedVersion)
    expect(document.checks[0]!.snapshot.current_version).toBe(tenant.version)
  })

  test('snapshots title, description, guide, and docs URL from the catalog, and severity and version from the check', () => {
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [{check_id: 'SCOPE_OVER_REQUEST', check_version: 1, status: 'executed'}],
    })
    const entry = RULE_CATALOG.find((catalogEntry) => catalogEntry.id === 'SCOPE_OVER_REQUEST')!
    const check = loadChecks().get('SCOPE_OVER_REQUEST')!

    expect(document.checks[0]!.snapshot).toEqual({
      title: entry.title,
      severity: check.severity,
      description: entry.description,
      guide: entry.guide,
      docs_url: entry.docsUrl,
      current_version: check.version,
      precedence: 'union',
    })
  })

  test('always writes the precedence into the snapshot so the file is self-describing', () => {
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [
        {check_id: 'CREDENTIAL_LOG_LEAKAGE', check_version: 1, status: 'executed'},
        {check_id: 'COMMITTED_SECRET', check_version: 2, status: 'executed'},
        {check_id: 'SCOPE_OVER_REQUEST', check_version: 1, status: 'executed'},
      ],
    })

    expect(document.checks.map((check) => [check.id, check.snapshot.precedence])).toEqual([
      ['COMMITTED_SECRET', 'union'],
      ['CREDENTIAL_LOG_LEAKAGE', 'prefer-agent'],
      ['SCOPE_OVER_REQUEST', 'union'],
    ])
  })

  test('redacts secrets in every piece of agent text', () => {
    const document = recordAccepted({
      schema_version: 1,
      checks_executed: [
        {
          check_id: 'OPEN_REDIRECT',
          check_version: 1,
          status: 'unresolved',
          reason: {code: 'needs_runtime', message: `Token ${FAKE_SHOPIFY_TOKEN} is used at runtime`},
        },
      ],
      findings: [
        finding({
          file: `app/${FAKE_SHOPIFY_TOKEN}.ts`,
          message: `Leaks ${FAKE_SHOPIFY_TOKEN}`,
          snippet: `const token = "${FAKE_SHOPIFY_TOKEN}"`,
          reasoning: `Found ${FAKE_SHOPIFY_TOKEN}`,
          suppression: {justification: `Rotated ${FAKE_SHOPIFY_TOKEN}`},
          evidence: [{file: `config/${FAKE_SHOPIFY_TOKEN}.ts`, line: 1, quote: FAKE_SHOPIFY_TOKEN}],
        }),
      ],
    })

    const serialized = JSON.stringify(document)
    expect(serialized).not.toContain(FAKE_SHOPIFY_TOKEN)
    expect(serialized).toContain('[REDACTED:')
    expect(document.checks.find((check) => check.id === 'OPEN_REDIRECT')!.reason!.message).toMatch(/REDACTED/)
  })

  test('rejects a not_applicable check that has findings', () => {
    const errors = recordRejected({
      schema_version: 1,
      checks_executed: [
        {check_id: tenant.id, check_version: 1, status: 'not_applicable', reason: {code: 'n/a', message: 'No data'}},
      ],
      findings: [finding()],
    })

    expect(errors).toEqual([`checks_executed[0] (${tenant.id}): a not_applicable check can't have findings`])
  })

  test('rejects an unresolved check without a reason', () => {
    const errors = recordRejected({
      schema_version: 1,
      checks_executed: [{check_id: tenant.id, check_version: 1, status: 'unresolved'}],
    })

    expect(errors).toEqual([`checks_executed[0] (${tenant.id}): unresolved requires a reason`])
  })

  test('rejects a duplicate check_id in checks_executed', () => {
    const entry = {check_id: tenant.id, check_version: 1, status: 'executed'}
    const errors = recordRejected({schema_version: 1, checks_executed: [entry, entry]})

    expect(errors).toEqual([`checks_executed[1] (${tenant.id}): duplicate check_id in checks_executed`])
  })

  test('creates an executed entry, using the claimed version, for a finding without a checks_executed entry', () => {
    const document = recordAccepted({
      schema_version: 1,
      findings: [finding({check_version: 5}), finding({line: 2, check_version: 5})],
    })

    expect(document.checks).toHaveLength(1)
    expect(document.checks[0]).toMatchObject({id: tenant.id, version: 5, status: 'executed'})
    expect(document.checks[0]!.findings).toHaveLength(2)
    expect(document.checks[0]!.reason).toBeUndefined()
  })

  test('rejects findings that disagree on check_version', () => {
    expect(
      recordRejected({schema_version: 1, findings: [finding({check_version: 1}), finding({check_version: 2})]}),
    ).toEqual([`${tenant.id}: findings claim different check_version values (1, 2)`])
    expect(
      recordRejected({
        schema_version: 1,
        checks_executed: [{check_id: tenant.id, check_version: 3, status: 'executed'}],
        findings: [finding({check_version: 1})],
      }),
    ).toEqual([`${tenant.id}: findings claim check_version 1, but its checks_executed entry claims 3`])
  })

  test('rejects unsafe paths', () => {
    const errors = recordRejected({
      schema_version: 1,
      findings: [
        finding({file: '/etc/passwd'}),
        finding({file: 'src/a\0.ts'}),
        finding({evidence: [{file: 'C:\\Windows\\system.ini', line: 1}]}),
      ],
    })

    expect(errors).toEqual([
      `findings[0] (${tenant.id}): unsafe file path (must be relative): /etc/passwd`,
      `findings[1] (${tenant.id}): unsafe file path (must be relative): src/a\0.ts`,
      `findings[2] (${tenant.id}): unsafe evidence file path: C:\\Windows\\system.ini`,
    ])
  })

  test('accepts findings in a scan directory outside the app directory, with ../ paths', () => {
    const document = recordAccepted({
      schema_version: 1,
      findings: [finding({file: '../backend/src/server.ts', evidence: [{file: '../library/src/auth.ts', line: 3}]})],
    })

    expect(document.checks[0]!.findings[0]).toMatchObject({
      location: {file: '../backend/src/server.ts'},
      evidence: [{location: {file: '../library/src/auth.ts', line: 3}}],
    })
  })

  test('rejects more findings than the cap without validating each one', () => {
    const errors = recordRejected({schema_version: 1, findings: Array.from({length: 1_001}, () => ({}))})

    expect(errors).toEqual(['findings contains 1001 findings, exceeding the limit of 1000'])
  })

  test('rejects more checks_executed entries than known checks without validating each one', () => {
    const checkCount = loadChecks().size
    const result = recordAgentFindings(
      {schema_version: 1, scope, checks_executed: Array.from({length: checkCount + 1}, () => ({}))},
      options,
    )

    if (result.ok) throw new Error('Expected the document to be rejected')
    expect(result.errors).toEqual([
      `checks_executed contains ${checkCount + 1} entries, exceeding the limit of ${checkCount}`,
    ])
  })

  test('ignores unknown keys and does not require source_scan_id, prompt_hash, or inspected_files', () => {
    const document = recordAccepted({
      schema_version: 1,
      source_scan_id: 'sha256:whatever',
      extra: {nested: true},
      checks_executed: [
        {check_id: tenant.id, check_version: tenant.version, status: 'executed', prompt_hash: 'sha256:old', notes: 'x'},
      ],
      findings: [
        finding({prompt_hash: 'sha256:old', severity: 'low', evidence: [{file: 'app/a.ts', line: 1, extra: 1}]}),
      ],
    })

    expect(document.checks[0]!.findings[0]).toEqual({
      location: {file: 'app/routes/orders.tsx', line: 12},
      message: 'Orders are loaded without a shop filter',
      evidence: [{location: {file: 'app/a.ts', line: 1}}],
    })
    expect(JSON.stringify(document)).not.toMatch(/source_scan_id|prompt_hash|inspected_files|notes|extra/)
  })
})

describe('recordAgentFindings code excerpts', () => {
  /** Twenty lines, `line 1` to `line 20`, with a final newline. */
  const ordersSource = `${Array.from({length: 20}, (_, index) => `line ${index + 1}`).join('\n')}\n`
  const lines = (first: number, last: number) =>
    Array.from({length: last - first + 1}, (_, index) => ({line: first + index, text: `line ${first + index}`}))

  function recordWithFiles(findings: Record<string, unknown>[], files: Record<string, string>) {
    const readCitedFile = vi.fn((file: string) => files[file])
    const result = recordAgentFindings(withScope({schema_version: 1, findings}), {...options, readCitedFile})
    if (!result.ok) throw new Error(`Expected the document to be accepted: ${result.errors.join('; ')}`)
    return {document: result.document, findings: result.document.checks[0]!.findings, readCitedFile}
  }

  test("stores the finding's line with two lines either side, and each evidence line", () => {
    const {document, findings} = recordWithFiles(
      [
        finding({
          evidence: [
            {file: 'app/routes/orders.tsx', line: 12, quote: 'prisma.order.findMany()'},
            {file: 'app/db.server.ts', line: 2},
          ],
        }),
      ],
      {
        'app/routes/orders.tsx': ordersSource,
        'app/db.server.ts': 'import {PrismaClient} from "@prisma/client"\nexport const db = new PrismaClient()',
      },
    )

    expect(findings[0]).toEqual({
      location: {file: 'app/routes/orders.tsx', line: 12},
      message: 'Orders are loaded without a shop filter',
      code_excerpt: lines(10, 14),
      evidence: [
        {
          location: {file: 'app/routes/orders.tsx', line: 12},
          quote: 'prisma.order.findMany()',
          code_excerpt: [{line: 12, text: 'line 12'}],
        },
        {
          location: {file: 'app/db.server.ts', line: 2},
          code_excerpt: [{line: 2, text: 'export const db = new PrismaClient()'}],
        },
      ],
    })
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('stores only the cited line of a file that may hold secrets and is not source code', () => {
    const {findings} = recordWithFiles(
      [
        finding({file: 'config/settings.yml', line: 5}),
        finding({file: 'Dockerfile', line: 5}),
        finding({file: 'scripts/deploy.sh', line: 5}),
        finding({file: 'app/routes/orders.tsx', line: 5}),
      ],
      {
        'config/settings.yml': ordersSource,
        Dockerfile: ordersSource,
        'scripts/deploy.sh': ordersSource,
        'app/routes/orders.tsx': ordersSource,
      },
    )

    expect(findings.map((stored) => stored.code_excerpt)).toEqual([lines(5, 5), lines(5, 5), lines(5, 5), lines(3, 7)])
  })

  test('keeps the excerpt inside the file, without the empty line after its final newline', () => {
    const {findings} = recordWithFiles([finding({line: 1}), finding({line: 20})], {
      'app/routes/orders.tsx': ordersSource,
    })

    expect(findings.map((stored) => stored.code_excerpt)).toEqual([lines(1, 3), lines(18, 20)])
  })

  test("stores no excerpt for a line the file doesn't have, a file it can't read, or evidence without a line", () => {
    const {findings} = recordWithFiles(
      [
        finding({line: 21, evidence: [{file: 'app/routes/orders.tsx'}, {file: 'app/missing.ts', line: 1}]}),
        finding({file: 'app/missing.ts', line: 1}),
      ],
      {'app/routes/orders.tsx': ordersSource},
    )

    expect(findings).toEqual([
      {
        location: {file: 'app/routes/orders.tsx', line: 21},
        message: 'Orders are loaded without a shop filter',
        evidence: [{location: {file: 'app/routes/orders.tsx'}}, {location: {file: 'app/missing.ts', line: 1}}],
      },
      {
        location: {file: 'app/missing.ts', line: 1},
        message: 'Orders are loaded without a shop filter',
        evidence: [
          {
            location: {file: 'app/routes/orders.tsx', line: 12},
            quote: 'prisma.order.findMany()',
            code_excerpt: [{line: 12, text: 'line 12'}],
          },
        ],
      },
    ])
  })

  test(`cuts a line after ${MAX_EXCERPT_LINE_LENGTH} characters, never inside one`, () => {
    // Each is two UTF-16 code units.
    const lock = '\u{1F512}'
    const padding = 'x'.repeat(MAX_EXCERPT_LINE_LENGTH - 1)
    const {findings} = recordWithFiles([finding({file: 'app/long.ts', line: 1})], {
      'app/long.ts': `${padding}${lock}${lock}tail\n${padding}${lock}\n`,
    })

    expect(findings[0]!.code_excerpt).toEqual([
      {line: 1, text: `${padding}${lock}…`},
      {line: 2, text: `${padding}${lock}`},
    ])
  })

  test('reads each cited file once, by its path with forward slashes', () => {
    const {findings, readCitedFile} = recordWithFiles(
      [
        finding({file: 'app\\routes\\orders.tsx', line: 3}),
        finding({
          evidence: [
            {file: 'app/routes/orders.tsx', line: 5},
            {file: 'app/other.ts', line: 1},
          ],
        }),
      ],
      {'app/routes/orders.tsx': ordersSource},
    )

    expect(findings[0]!.code_excerpt).toEqual(lines(1, 5))
    expect(readCitedFile.mock.calls).toEqual([['app/routes/orders.tsx'], ['app/other.ts']])
  })

  test('never takes an excerpt from the agent', () => {
    const forged = [{line: 12, text: 'not what the file says'}]
    const document = recordAccepted({
      schema_version: 1,
      findings: [
        finding({code_excerpt: forged, evidence: [{file: 'app/routes/orders.tsx', line: 12, code_excerpt: forged}]}),
      ],
    })

    expect(JSON.stringify(document)).not.toContain('code_excerpt')
  })
})
