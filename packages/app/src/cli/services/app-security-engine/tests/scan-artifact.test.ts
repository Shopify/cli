import {formatJson} from '../output/format.js'
import {combineFindings} from '../results/combine.js'
import {translateFindingsDocument} from '../results/translate.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {scan} from '../scanners/index.js'
import {buildDeterministicFindings, containsUnredactedSecret} from '../scan-artifact/index.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {CheckExecution, Issue, ScanResult} from '../types.js'

const execution = (overrides: Partial<CheckExecution> = {}): CheckExecution => ({
  id: 'CREDENTIAL_LOG_LEAKAGE',
  version: 1,
  kind: 'deterministic',
  status: 'executed',
  applicable: true,
  languages: ['typescript'],
  framework: 'react_router',
  surface: 'react_router',
  inspected_files: ['app/a.ts'],
  findings: 0,
  analysis_mode: 'regex',
  ...overrides,
})

const result = (issues: Issue[] = [], checksExecuted: CheckExecution[] = [execution()]): ScanResult => ({
  version: '0.1.0',
  timestamp: '2026-08-28T00:00:00.000Z',
  project: {commit: 'a'.repeat(40), dirty: false},
  app: {name: 'scan-artifact-test', type: 'public'},
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/a.ts']}],
  },
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: true,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-28T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: checksExecuted.map((check) => ({
      ...check,
      findings: issues.filter((issue) => issue.id === check.id).length,
    })),
  },
  issues,
})

const deterministicIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'CREDENTIAL_LOG_LEAKAGE',
  rule_version: 1,
  severity: 'high',
  points: -20,
  title: 'Token logged',
  message: 'A token is logged',
  location: {file: 'app/a.ts', line: 2},
  evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
  snippet: 'console.log(token)',
  fix: {automated: false, description: 'Remove it'},
  ...overrides,
})

const catalogEntry = (id: string) => RULE_CATALOG.find((entry) => entry.id === id)!

describe('buildDeterministicFindings', () => {
  test('builds the exact deterministic document, with findings nested under their check', () => {
    const document = buildDeterministicFindings(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })

    expect(document).toEqual({
      schema_version: 1,
      source: 'deterministic',
      engine: {name: 'shopify-app-security', version: '0.1.0', ruleset: 'app-security-rules@0.1.0'},
      generated_at: '2026-08-28T00:00:00.000Z',
      project: {commit: 'a'.repeat(40), dirty: false},
      detection: {
        framework: 'react_router',
        surface: 'react_router',
        languages: [{name: 'typescript', support: 'supported', files: ['app/a.ts']}],
      },
      coverage: {files_scanned: 1, files_skipped: [], gaps: []},
      checks: [
        {
          id: 'CREDENTIAL_LOG_LEAKAGE',
          version: 1,
          status: 'executed',
          analysis_mode: 'regex',
          snapshot: {
            title: 'Credential reaches a log sink',
            severity: 'high',
            description: 'Detects direct credential flows to console and logger sinks.',
            current_version: 1,
          },
          findings: [
            {
              location: {file: 'app/a.ts', line: 2},
              message: 'A token is logged',
              evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
              snippet: 'console.log(token)',
              fix: {automated: false, description: 'Remove it'},
            },
          ],
        },
      ],
    })
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('snapshots the catalog, not the per-finding severity and title', () => {
    const document = buildDeterministicFindings(
      result(
        [deterministicIssue({id: 'EOL_API_VERSION', severity: 'high', title: 'Wrong title'})],
        [execution({id: 'EOL_API_VERSION', analysis_mode: 'structured_config'})],
      ),
    )
    const entry = catalogEntry('EOL_API_VERSION')

    expect(document.checks[0]!.snapshot).toEqual({
      title: entry.title,
      severity: 'low',
      description: entry.description,
      guide: entry.guide,
      current_version: 1,
    })
    expect(document.checks[0]!.findings[0]).not.toHaveProperty('severity')
    expect(document.checks[0]!.findings[0]).not.toHaveProperty('title')
  })

  test('keeps the per-finding fix, including its guide', () => {
    const fix = {automated: true, description: 'Use textContent', guide: 'https://example.com/guide'}
    const document = buildDeterministicFindings(result([deterministicIssue({fix})]))

    expect(document.checks[0]!.findings[0]!.fix).toEqual(fix)
  })

  test('sorts checks by id and each check’s findings by file, line, and message', () => {
    const document = buildDeterministicFindings(
      result(
        [
          deterministicIssue({location: {file: 'app/b.ts', line: 1}}),
          deterministicIssue({location: {file: 'app/a.ts', line: 10}}),
          deterministicIssue({location: {file: 'app/a.ts', line: 9}, message: 'second'}),
          deterministicIssue({location: {file: 'app/a.ts', line: 9}, message: 'first'}),
          deterministicIssue({id: 'COMMITTED_SECRET', location: {file: 'zzz.env'}}),
        ],
        [execution({id: 'CREDENTIAL_LOG_LEAKAGE'}), execution({id: 'COMMITTED_SECRET'})],
      ),
    )

    expect(document.checks.map((check) => check.id)).toEqual(['COMMITTED_SECRET', 'CREDENTIAL_LOG_LEAKAGE'])
    expect(
      document.checks[1]!.findings.map(
        (finding) => `${finding.location.file}:${finding.location.line}:${finding.message}`,
      ),
    ).toEqual([
      'app/a.ts:9:first',
      'app/a.ts:9:second',
      'app/a.ts:10:A token is logged',
      'app/b.ts:1:A token is logged',
    ])
  })

  test('orders findings in code-point order, the same order the combiner uses', () => {
    const document = buildDeterministicFindings(
      result([
        deterministicIssue({location: {file: 'app/a.ts', line: 1}}),
        deterministicIssue({location: {file: 'app/a', line: 1}}),
        deterministicIssue({location: {file: 'app/a'}}),
        deterministicIssue({location: {file: 'app/_.ts', line: 1}}),
      ]),
    )
    const locations = (findings: {location: {file: string; line?: number}}[]) =>
      findings.map((finding) => `${finding.location.file}:${finding.location.line ?? '-'}`)

    expect(locations(document.checks[0]!.findings)).toEqual(['app/_.ts:1', 'app/a:-', 'app/a:1', 'app/a.ts:1'])
    const [combined] = combineFindings({deterministic: document, agent: null})
    expect(locations(combined!.findings)).toEqual(locations(document.checks[0]!.findings))
  })

  test('maps unsupported_framework to unresolved and drops applicable and the findings count', () => {
    const document = buildDeterministicFindings(
      result(
        [],
        [
          execution({
            status: 'unsupported_framework',
            applicable: true,
            reason: {code: 'unsupported_framework', message: 'Needs React Router.'},
          }),
          execution({
            id: 'EOL_API_VERSION',
            status: 'not_applicable',
            applicable: false,
            reason: {code: 'no_relevant_files', message: 'No config.'},
          }),
        ],
      ),
    )

    expect(document.checks.map((check) => [check.id, check.status, check.reason])).toEqual([
      ['CREDENTIAL_LOG_LEAKAGE', 'unresolved', {code: 'unsupported_framework', message: 'Needs React Router.'}],
      ['EOL_API_VERSION', 'not_applicable', {code: 'no_relevant_files', message: 'No config.'}],
    ])
    for (const check of document.checks) {
      expect(check).not.toHaveProperty('applicable')
      expect(check.findings).toEqual([])
    }
  })

  test('throws when a finding belongs to a check that was not executed', () => {
    expect(() => buildDeterministicFindings(result([deterministicIssue({id: 'COMMITTED_SECRET'})]))).toThrow(
      'COMMITTED_SECRET',
    )
  })

  test('redacts coverage and execution reasons', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const scanResult = result()
    scanResult.scan.files_skipped = [{path: `app/${secret}.ts`, reason: 'unreadable', detail: `detail ${secret}`}]
    scanResult.scan.coverage_gaps = [
      {code: 'skipped_file', message: `gap ${secret}`, file: `app/${secret}.ts`},
      {code: 'unresolved_check', message: 'Parser failed.', check_id: 'CREDENTIAL_LOG_LEAKAGE'},
    ]
    scanResult.scan.checks_executed[0]!.status = 'unresolved'
    scanResult.scan.checks_executed[0]!.reason = {code: 'parser_unavailable', message: `reason ${secret}`}

    const document = buildDeterministicFindings(scanResult)
    const serialized = JSON.stringify(document)

    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')
    expect(document.checks[0]!.reason!.message).toMatch(/REDACTED/)
    expect(document.coverage.gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'CREDENTIAL_LOG_LEAKAGE'}),
    )
    expect(containsUnredactedSecret(document)).toBe(false)
  })

  test('fails closed when text contains more secret matches than the work cap', () => {
    const secrets = Array.from({length: 150}, (_, index) => `AKIA${index.toString(36).toUpperCase().padStart(16, 'A')}`)
    const scanResult = result([deterministicIssue({message: secrets.join(' ')})])
    const outputs = [JSON.stringify(buildDeterministicFindings(scanResult)), formatJson(scanResult)]
    for (const output of outputs) {
      for (const secret of secrets) expect(output).not.toContain(secret)
      expect(output).toContain('[REDACTED TEXT]')
    }
  })

  test('redacts complete private key blocks from every free-form finding field', () => {
    const header = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ')
    const body = ['private-key-body', 'must-not-leak'].join('-')
    const footer = ['-----END RSA', 'PRIVATE KEY-----'].join(' ')
    const block = `${header}\n${body}\n${footer}`
    const issue = deterministicIssue({
      message: block,
      snippet: block,
      detection_evidence: [block],
    })
    issue.evidence = [{location: issue.location, quote: block}]

    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))
    expect(serialized).not.toContain(body)
    expect(serialized).not.toContain(footer)
    expect(serialized).toContain('REDACTED')
  })

  test('redacts matched secrets from every finding output field', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const issue = deterministicIssue({
      message: `message ${secret}`,
      snippet: `snippet ${secret}`,
      location: {file: `app/${secret}.ts`, line: 2},
      fix: {automated: false, description: `fix ${secret}`, guide: `https://example.com/${secret}`},
    })
    issue.evidence = [{location: {file: `app/${secret}.ts`, line: 2}, quote: `quote ${secret}`}]
    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')

    const scanResult = result([issue])
    scanResult.app.name = `app ${secret}`
    expect(formatJson(scanResult)).not.toContain(secret)
  })

  test('records skipped inputs from a real scan as coverage gaps and translates back', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        joinPath(directory, 'shopify.app.toml'),
        'name = "manifests"\napplication_url = "https://example.com"\n',
      )
      await writeFile(joinPath(directory, 'package.json'), '{invalid')

      const document = buildDeterministicFindings(await scan(directory))

      expect(document.coverage.files_skipped).toContainEqual(
        expect.objectContaining({path: 'package.json', reason: 'unreadable'}),
      )
      expect(document.coverage.gaps).toContainEqual(
        expect.objectContaining({code: 'skipped_file', file: 'package.json'}),
      )
      expect(document.checks.length).toBeGreaterThan(0)
      expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
    })
  })
})

describe('containsUnredactedSecret', () => {
  const secret = `shpat_${'a'.repeat(24)}`

  test('finds secrets in nested strings and object keys', () => {
    expect(containsUnredactedSecret({findings: [{message: 'safe'}]})).toBe(false)
    expect(containsUnredactedSecret({findings: [{message: `leaked ${secret}`}]})).toBe(true)
    expect(containsUnredactedSecret({coverage: {[secret]: true}})).toBe(true)
  })

  test('handles cycles and fails closed on excessively deep input', () => {
    const cyclic: Record<string, unknown> = {message: 'safe'}
    cyclic.self = cyclic
    expect(containsUnredactedSecret(cyclic)).toBe(false)

    let deep: unknown = 'safe'
    for (let depth = 0; depth < 200; depth++) deep = [deep]
    expect(containsUnredactedSecret(deep)).toBe(true)
  })
})
