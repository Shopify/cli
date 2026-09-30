import {formatJson} from '../output/format.js'
import {scan} from '../scanners/index.js'
import {
  buildDeterministicFindings,
  containsUnredactedSecret,
  parseDeterministicFindings,
} from '../scan-artifact/index.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {Issue, ScanResult} from '../types.js'

const result = (issues: Issue[] = []): ScanResult => ({
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
    checks_executed: [
      {
        id: 'CREDENTIAL_LOG_LEAKAGE',
        version: 1,
        kind: 'deterministic',
        status: 'executed',
        applicable: true,
        languages: ['typescript'],
        framework: 'react_router',
        surface: 'react_router',
        inspected_files: ['app/a.ts'],
        findings: issues.length,
        analysis_mode: 'regex',
      },
    ],
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

describe('buildDeterministicFindings', () => {
  test('builds self-describing deterministic findings with only deterministic results', () => {
    const artifact = buildDeterministicFindings(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })

    expect(artifact).toEqual({
      schema_version: 1,
      engine: {name: 'shopify-app-security', version: '0.1.0', ruleset: 'app-security-rules@0.1.0'},
      generated_at: '2026-08-28T00:00:00.000Z',
      project: {commit: 'a'.repeat(40), dirty: false},
      detection: {
        framework: 'react_router',
        surface: 'react_router',
        languages: [{name: 'typescript', support: 'supported', files: ['app/a.ts']}],
      },
      findings: [
        {
          rule_id: 'CREDENTIAL_LOG_LEAKAGE',
          rule_version: 1,
          severity: 'high',
          title: 'Token logged',
          message: 'A token is logged',
          location: {file: 'app/a.ts', line: 2},
          evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
          snippet: 'console.log(token)',
          fix: {automated: false, description: 'Remove it'},
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
      ],
      coverage: {files_scanned: 1, files_skipped: [], gaps: []},
    })
  })

  test('orders findings by rule, file, and line', () => {
    const artifact = buildDeterministicFindings(
      result([
        deterministicIssue({location: {file: 'app/b.ts', line: 1}}),
        deterministicIssue({location: {file: 'app/a.ts', line: 10}}),
        deterministicIssue({location: {file: 'app/a.ts', line: 9}}),
      ]),
    )

    expect(artifact.findings.map((finding) => `${finding.location.file}:${finding.location.line}`)).toEqual([
      'app/a.ts:9',
      'app/a.ts:10',
      'app/b.ts:1',
    ])
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

    const artifact = buildDeterministicFindings(scanResult)
    const serialized = JSON.stringify(artifact)

    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')
    expect(artifact.coverage.gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'CREDENTIAL_LOG_LEAKAGE'}),
    )
    expect(containsUnredactedSecret(artifact)).toBe(false)
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
      title: `title ${secret}`,
      message: `message ${secret}`,
      snippet: `snippet ${secret}`,
      fix: {automated: false, description: `fix ${secret}`, guide: `https://example.com/${secret}`},
    })
    issue.evidence = [{location: issue.location, quote: `quote ${secret}`}]
    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')

    const scanResult = result([issue])
    scanResult.app.name = `app ${secret}`
    expect(formatJson(scanResult)).not.toContain(secret)
  })

  test('records skipped inputs from a real scan as coverage gaps', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        joinPath(directory, 'shopify.app.toml'),
        'name = "manifests"\napplication_url = "https://example.com"\n',
      )
      await writeFile(joinPath(directory, 'package.json'), '{invalid')

      const artifact = buildDeterministicFindings(await scan(directory))

      expect(artifact.coverage.files_skipped).toContainEqual(
        expect.objectContaining({path: 'package.json', reason: 'unreadable'}),
      )
      expect(artifact.coverage.gaps).toContainEqual(
        expect.objectContaining({code: 'skipped_file', file: 'package.json'}),
      )
      expect(parseDeterministicFindings(JSON.parse(JSON.stringify(artifact)))).toEqual({ok: true, artifact})
    })
  })
})

describe('parseDeterministicFindings', () => {
  test('accepts an object with the current schema version and a findings array', () => {
    const artifact = buildDeterministicFindings(result())

    expect(parseDeterministicFindings(artifact)).toEqual({ok: true, artifact})
  })

  test('rejects non-objects, other schema versions, and a missing findings array', () => {
    expect(parseDeterministicFindings(null)).toEqual({
      ok: false,
      errors: ['deterministic findings must be a JSON object'],
    })
    expect(parseDeterministicFindings([])).toMatchObject({ok: false})
    expect(parseDeterministicFindings({schema_version: 3, findings: []})).toEqual({
      ok: false,
      errors: ['unsupported schema_version: 3 (expected 1)'],
    })
    expect(parseDeterministicFindings({schema_version: 1})).toEqual({ok: false, errors: ['findings must be an array']})
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
