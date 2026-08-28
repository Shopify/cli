/* eslint-disable no-restricted-imports -- trace fixtures use Node temporary-directory primitives */
import {computeResultHash} from '../scorer/index.js'
import {
  compileTrace,
  formatConsole,
  formatJson,
  mergeExternalFindings,
  scan,
  sha256,
  validateTrace,
  validateExternalFinding,
  validateSuppression,
  type Issue,
  type ScanResult,
  type Suppression,
} from '../index.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, {recursive: true, force: true})))

const result = (issues: Issue[] = []): ScanResult => ({
  version: '0.1.0',
  timestamp: '2026-08-28T00:00:00.000Z',
  project: {commit: 'a'.repeat(40), dirty: false},
  app: {name: 'trace-test', type: 'public'},
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: true,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  score: {total: 70, baseline: 70, grade: 'NEEDS_WORK'},
  scan: {
    timestamp: '2026-08-28T00:00:00.000Z',
    doctor_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    input_hash: `sha256:${'b'.repeat(64)}`,
    result_hash: `sha256:${'c'.repeat(64)}`,
    file_hashes: {'app/a.ts': `sha256:${'d'.repeat(64)}`},
    checks_executed: [
      {
        id: 'TOKEN_LEAKAGE',
        version: 1,
        kind: 'rule',
        status: 'executed',
        findings: 0,
      },
    ],
  },
  issues,
})

const deterministicIssue = (): Issue => ({
  id: 'TOKEN_LEAKAGE',
  rule_version: 1,
  found_by: 'static',
  severity: 'high',
  points: -20,
  title: 'Token logged',
  message: 'A token is logged',
  location: {file: 'app/a.ts', line: 2},
  evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
  snippet: 'console.log(token)',
  fix: {automated: false, description: 'Remove it'},
})

describe('trace v1', () => {
  test('compiles and validates a portable v1 trace with zero-finding checks', () => {
    const trace = compileTrace(result(), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(trace.schema_version).toBe(1)
    expect(trace.engine.name).toBe('shopify-app-doctor')
    expect(trace.project).toMatchObject({
      commit: 'a'.repeat(40),
      dirty: false,
    })
    expect(trace.checks_executed).toContainEqual(
      expect.objectContaining({
        id: 'TOKEN_LEAKAGE',
        status: 'executed',
        findings: 0,
      }),
    )
    expect(trace.attestation).toMatchObject({signed: false})
    expect(trace.attestation.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(validateTrace(trace)).toEqual({valid: true, errors: []})
  })

  test('rejects malformed required fields even when the outer digest is recomputed', () => {
    const trace = compileTrace(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    const malformed = structuredClone(trace) as unknown as Record<string, any>
    malformed.generated_at = 'not-a-date'
    malformed.engine.name = 'not-app-doctor'
    malformed.project.input_hashes['/etc/passwd'] = `sha256:${'f'.repeat(64)}`
    malformed.findings[0].rule_version = -1
    malformed.findings[0].fingerprint = 'not-a-hash'
    delete malformed.findings[0].title
    delete malformed.findings[0].fix
    delete malformed.coverage.files_scanned
    const {attestation: _old, ...unsigned} = malformed
    malformed.attestation = {digest: sha256(unsigned), signed: false}
    const errors = validateTrace(malformed).errors.join(' ')
    expect(errors).toMatch(/generated_at/)
    expect(errors).toMatch(/engine/)
    expect(errors).toMatch(/project/)
    expect(errors).toMatch(/fingerprint/)
    expect(errors).toMatch(/provenance/)
    expect(errors).toMatch(/coverage/)
    expect(
      validateSuppression({
        id: 'bad-actor',
        finding_fingerprint: `sha256:${'a'.repeat(64)}`,
        justification: 'test',
        provenance: {
          source: 'human',
          actor: 42,
          created_at: '2026-08-28T00:00:00.000Z',
        },
      }),
    ).toMatch(/actor/)
  })

  test('never throws on cyclic or excessively deep unknown input', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => validateTrace(cyclic)).not.toThrow()
    expect(validateTrace(cyclic).valid).toBe(false)
    let deep: Record<string, unknown> = {}
    const root = deep
    for (let index = 0; index < 200; index++) {
      deep.next = {}
      deep = deep.next as Record<string, unknown>
    }
    expect(() => validateTrace(root)).not.toThrow()
    expect(validateTrace(root).valid).toBe(false)
  })

  test('rejects unknown schemas, malformed provenance, and a changed digest', () => {
    const trace = compileTrace(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(validateTrace({...trace, schema_version: 2}).errors).toContain('unsupported schema_version: 2')
    const changed = structuredClone(trace)
    const [changedFinding] = changed.findings
    if (!changedFinding) throw new Error('Expected the trace to contain a finding')
    changedFinding.message = 'edited'
    expect(validateTrace(changed).errors).toContain('attestation digest mismatch')
    const malformed = structuredClone(trace) as unknown as {
      findings: Record<string, unknown>[]
    }
    const [malformedFinding] = malformed.findings
    if (!malformedFinding) throw new Error('Expected the trace to contain a finding')
    delete malformedFinding.rule_version
    expect(validateTrace(malformed).errors.some((error) => error.includes('rule provenance'))).toBe(true)
  })

  test('recomputes the scan result hash over merged finding content', () => {
    const scanResult = result()
    const before = computeResultHash(scanResult.issues, scanResult.score)
    scanResult.issues.push(deterministicIssue())
    expect(computeResultHash(scanResult.issues, scanResult.score)).not.toBe(before)
    const changed = deterministicIssue()
    changed.evidence = [{location: changed.location, quote: 'different'}]
    expect(computeResultHash([changed], scanResult.score)).not.toBe(
      computeResultHash([deterministicIssue()], scanResult.score),
    )
  })

  test('hashes full finding messages, locations, snippets, and evidence independent of ordering', () => {
    const base = deterministicIssue()
    const first = compileTrace(result([base]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    for (const changed of [
      {...base, message: 'different'},
      {...base, location: {...base.location, line: 3}},
      {...base, snippet: 'different'},
      {...base, evidence: [{location: base.location, quote: 'different'}]},
    ]) {
      expect(compileTrace(result([changed]), {generatedAt: first.generated_at}).attestation.digest).not.toBe(
        first.attestation.digest,
      )
    }
    const second = {...base, location: {file: 'app/b.ts', line: 1}}
    expect(compileTrace(result([base, second]), {generatedAt: first.generated_at}).attestation.digest).toBe(
      compileTrace(result([second, base]), {generatedAt: first.generated_at}).attestation.digest,
    )
  })

  test('preserves justified suppression provenance and attaches it by fingerprint', () => {
    const initial = compileTrace(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    const [initialFinding] = initial.findings
    if (!initialFinding) throw new Error('Expected the trace to contain a finding')
    const suppression: Suppression = {
      id: 'approved-risk',
      finding_fingerprint: initialFinding.fingerprint,
      justification: 'Accepted for the migration window',
      provenance: {
        source: 'human',
        actor: 'security@example.com',
        created_at: '2026-08-28T00:00:00.000Z',
      },
    }
    const trace = compileTrace(result([deterministicIssue()]), {
      suppressions: [suppression],
      generatedAt: initial.generated_at,
    })
    expect(trace.findings[0]?.suppression?.id).toBe('approved-risk')
    expect(trace.suppressions).toEqual([suppression])
    expect(validateTrace(trace).valid).toBe(true)
  })

  test('rejects malformed, unsafe, and unbounded external findings', () => {
    const valid = {
      rule_id: 'VENDOR_RULE',
      rule_version: 1,
      severity: 'low' as const,
      title: 'Vendor',
      message: 'Review',
      location: {file: 'app/a.ts', line: 1},
    }
    expect(validateExternalFinding({...valid, rule_id: ''})).toMatch(/rule_id/)
    expect(validateExternalFinding({...valid, location: {file: '../secret'}})).toMatch(/unsafe/)
    expect(
      mergeExternalFindings([], [{...valid, location: {file: 'unknown.ts'}}], {knownFiles: new Set(['app/a.ts'])})
        .rejected[0],
    ).toMatch(/scanned inputs/)
    expect(
      mergeExternalFindings(
        [],
        Array.from({length: 1_001}, () => valid),
      ).rejected[0],
    ).toMatch(/limit/)
  })

  test('rejects suppressions that do not match a current finding', () => {
    expect(() =>
      compileTrace(result(), {
        suppressions: [
          {
            id: 'stale',
            finding_fingerprint: `sha256:${'e'.repeat(64)}`,
            justification: 'Old exception',
            provenance: {
              source: 'human',
              created_at: '2026-08-28T00:00:00.000Z',
            },
          },
        ],
      }),
    ).toThrow(/did not match/)
  })

  test('accepts external findings with explicit source and rule provenance', () => {
    const scanResult = result()
    expect(
      mergeExternalFindings(scanResult.issues, [
        {
          rule_id: 'VENDOR_RULE',
          rule_version: 3,
          severity: 'low',
          title: 'Vendor finding',
          message: 'Review',
          location: {file: 'app/a.ts', line: 1},
        },
      ]).accepted,
    ).toBe(1)
    const trace = compileTrace(scanResult, {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(trace.findings[0]).toMatchObject({
      source: 'external',
      rule_id: 'VENDOR_RULE',
      rule_version: 3,
    })
    expect(validateTrace(trace).valid).toBe(true)
  })

  test('fails closed when text contains more secret matches than the work cap', () => {
    const secrets = Array.from({length: 150}, (_, index) => `AKIA${index.toString(36).toUpperCase().padStart(16, 'A')}`)
    const issue = deterministicIssue()
    issue.message = secrets.join(' ')
    const scanResult = result([issue])
    const outputs = [
      JSON.stringify(compileTrace(scanResult)),
      formatConsole(scanResult, {verbose: true}),
      formatJson(scanResult),
    ]
    for (const output of outputs) {
      for (const secret of secrets) expect(output).not.toContain(secret)
      expect(output).toContain('[REDACTED TEXT]')
    }
  })

  test('redacts matched secrets from every finding output field', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const issue = deterministicIssue()
    issue.title = `title ${secret}`
    issue.message = `message ${secret}`
    issue.snippet = `snippet ${secret}`
    issue.evidence = [{location: issue.location, quote: `quote ${secret}`}]
    issue.fix.description = `fix ${secret}`
    issue.fix.guide = `https://example.com/${secret}`
    const serialized = JSON.stringify(compileTrace(result([issue])))
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')

    const scanResult = result([issue])
    scanResult.app.name = `app ${secret}`
    expect(formatConsole(scanResult, {verbose: true})).not.toContain(secret)
    expect(formatJson(scanResult)).not.toContain(secret)
  })
})

describe('strong scan input hashes', () => {
  const app = (name: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'app-doctor-trace-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'shopify.app.toml'), `name = "${name}"\napplication_url = "https://example.com"\n`)
    return dir
  }

  test('hashes valid and invalid manifests using project-relative paths', async () => {
    const dir = app('manifests')
    writeFileSync(join(dir, 'package.json'), '{"dependencies":{"react":"1.0.0"}}')
    const valid = await scan(dir)
    expect(valid.scan.file_hashes?.['package.json']).toMatch(/^sha256:[0-9a-f]{64}$/)
    writeFileSync(join(dir, 'package.json'), '{invalid')
    const invalid = await scan(dir)
    expect(invalid.scan.file_hashes?.['package.json']).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(invalid.scan.files_skipped).toContainEqual(
      expect.objectContaining({path: 'package.json', reason: 'unreadable'}),
    )
    expect(compileTrace(invalid).coverage.complete).toBe(false)
  })

  test('includes config bytes and file paths', async () => {
    const dir = app('first')
    writeFileSync(join(dir, 'a.ts'), 'export const same = true;')
    const before = await scan(dir)
    writeFileSync(join(dir, 'shopify.app.toml'), 'name = "second"\napplication_url = "https://example.com"\n')
    const configChanged = await scan(dir)
    expect(configChanged.scan.input_hash).not.toBe(before.scan.input_hash)

    rmSync(join(dir, 'a.ts'))
    writeFileSync(join(dir, 'b.ts'), 'export const same = true;')
    const pathChanged = await scan(dir)
    expect(pathChanged.scan.input_hash).not.toBe(configChanged.scan.input_hash)
  })
})
