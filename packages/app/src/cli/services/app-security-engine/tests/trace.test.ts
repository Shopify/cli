import {formatJson} from '../output/format.js'
import {compileTrace, validateTrace} from '../trace/index.js'
import {describe, expect, test} from 'vitest'
import type {Issue, ScanResult} from '../types.js'

const result = (issues: Issue[] = []): ScanResult => ({
  version: '0.1.0',
  timestamp: '2026-08-28T00:00:00.000Z',
  project: {commit: 'a'.repeat(40), dirty: false},
  app: {name: 'trace-test', type: 'public'},
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
    coverage_complete: true,
    coverage_gaps: [],
    checks_executed: [
      {
        id: 'CREDENTIAL_LOG_LEAKAGE',
        version: 1,
        kind: 'deterministic',
        status: 'executed',
        required: true,
        applicable: true,
        languages: ['typescript'],
        framework: 'react_router',
        surface: 'react_router',
        inspected_files: ['app/a.ts'],
        findings: 0,
        analysis_mode: 'regex',
      },
    ],
  },
  issues,
})

const deterministicIssue = (): Issue => ({
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
})

describe('trace v2', () => {
  test('compiles and validates a portable v2 trace with zero-finding checks', () => {
    const trace = compileTrace(result(), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(trace.schema_version).toBe(3)
    expect(trace.engine.name).toBe('shopify-app-security')
    expect(trace.project).toMatchObject({
      commit: 'a'.repeat(40),
      dirty: false,
    })
    expect(trace.checks_executed).toContainEqual(
      expect.objectContaining({
        id: 'CREDENTIAL_LOG_LEAKAGE',
        status: 'executed',
        findings: 0,
      }),
    )
    expect(validateTrace(trace)).toEqual({valid: true, errors: []})
  })

  test('rejects malformed required fields', () => {
    const trace = compileTrace(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    const malformed = structuredClone(trace) as unknown as Record<string, any>
    malformed.generated_at = 'not-a-date'
    malformed.engine.name = 'not-app-security'
    malformed.project.commit = ''
    malformed.findings[0].rule_version = -1
    delete malformed.findings[0].title
    delete malformed.findings[0].fix
    delete malformed.coverage.files_scanned
    const errors = validateTrace(malformed).errors.join(' ')
    expect(errors).toMatch(/generated_at/)
    expect(errors).toMatch(/engine/)
    expect(errors).toMatch(/project/)
    expect(errors).toMatch(/provenance/)
    expect(errors).toMatch(/coverage/)
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

  test('rejects unknown schemas and malformed provenance', () => {
    const trace = compileTrace(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(validateTrace({...trace, schema_version: 1}).errors).toContain('unsupported schema_version: 1')
    expect(validateTrace({...trace, schema_version: 2}).errors).toContain('unsupported schema_version: 2')
    const malformed = structuredClone(trace) as unknown as {
      findings: Record<string, unknown>[]
    }
    const [malformedFinding] = malformed.findings
    if (!malformedFinding) throw new Error('Expected the trace to contain a finding')
    delete malformedFinding.rule_version
    expect(validateTrace(malformed).errors.some((error) => error.includes('rule provenance'))).toBe(true)
  })

  test('fails closed when text contains more secret matches than the work cap', () => {
    const secrets = Array.from({length: 150}, (_, index) => `AKIA${index.toString(36).toUpperCase().padStart(16, 'A')}`)
    const issue = deterministicIssue()
    issue.message = secrets.join(' ')
    const scanResult = result([issue])
    const outputs = [JSON.stringify(compileTrace(scanResult)), formatJson(scanResult)]
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
    const issue = deterministicIssue()
    issue.message = block
    issue.snippet = block
    issue.detection_evidence = [block]
    issue.evidence = [{location: issue.location, quote: block}]

    const serialized = JSON.stringify(compileTrace(result([issue])))
    expect(serialized).not.toContain(body)
    expect(serialized).not.toContain(footer)
    expect(serialized).toContain('REDACTED')
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
    expect(formatJson(scanResult)).not.toContain(secret)
  })
})
