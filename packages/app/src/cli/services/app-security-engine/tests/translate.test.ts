import {agentFindingsDocument, deterministicFindingsDocument} from './fixtures/findings-documents.js'
import {translateFindingsDocument} from '../results/translate.js'
import {STORED_TYPES_MATCH_SCHEMA_V1} from '../results/schema.js'
import {describe, expect, test} from 'vitest'

/** A JSON round trip, so the input is a plain value with no shared references to the fixture. */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

function translateInvalid(value: unknown): string[] {
  const result = translateFindingsDocument(value)
  if (result.ok) throw new Error('Expected the document to be rejected')
  return result.errors
}

describe('findings document fixtures', () => {
  test('cover both precedences on checks that appear in both sources', () => {
    const deterministicIds = new Set(deterministicFindingsDocument.checks.map((check) => check.id))
    const shared = agentFindingsDocument.checks.filter((check) => deterministicIds.has(check.id))

    expect(shared.map((check) => check.snapshot.precedence)).toEqual(expect.arrayContaining(['prefer-agent', 'union']))
    expect(agentFindingsDocument.checks.every((check) => check.snapshot.precedence !== undefined)).toBe(true)
    expect(deterministicFindingsDocument.checks.every((check) => check.snapshot.precedence === undefined)).toBe(true)
  })
})

describe('translateFindingsDocument', () => {
  test('keeps the stored types and the Zod schema in sync', () => {
    // `tsc` is the real check: the constant only compiles when the types match the schema.
    expect(STORED_TYPES_MATCH_SCHEMA_V1).toBe(true)
  })

  test('accepts a deterministic document', () => {
    expect(translateFindingsDocument(asJson(deterministicFindingsDocument))).toEqual({
      ok: true,
      document: deterministicFindingsDocument,
    })
  })

  test('accepts an agent document', () => {
    expect(translateFindingsDocument(asJson(agentFindingsDocument))).toEqual({
      ok: true,
      document: agentFindingsDocument,
    })
  })

  test("keeps a check's docs_url", () => {
    const docsUrl = 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version'
    const [first, ...rest] = deterministicFindingsDocument.checks
    const document = {
      ...deterministicFindingsDocument,
      checks: [{...first!, snapshot: {...first!.snapshot, docs_url: docsUrl}}, ...rest],
    }

    expect(translateFindingsDocument(asJson(document))).toEqual({ok: true, document})
  })

  test('strips unknown keys at every level', () => {
    const document = asJson(agentFindingsDocument) as Record<string, any>
    document.extra = 'ignored'
    document.checks[0].notes = 'ignored'
    document.checks[0].snapshot.points = -20
    document.checks[0].findings[0].severity = 'high'
    document.checks[0].findings[0].evidence[0].extra = true

    expect(translateFindingsDocument(document)).toEqual({ok: true, document: agentFindingsDocument})
  })

  test('rejects an unknown enum value with its path', () => {
    const document = asJson(deterministicFindingsDocument) as Record<string, any>
    document.checks[0].status = 'unsupported_framework'
    document.checks[1].snapshot.severity = 'critical'
    document.checks[2].analysis_mode = 'llm'
    document.detection.framework = 'remix'
    document.coverage.files_skipped[0].reason = 'binary'

    const errors = translateInvalid(document)

    expect(errors).toEqual([
      expect.stringMatching(/^checks\[0\]\.status: .*unsupported_framework/),
      expect.stringMatching(/^checks\[1\]\.snapshot\.severity: .*critical/),
      expect.stringMatching(/^checks\[2\]\.analysis_mode: .*llm/),
      expect.stringMatching(/^detection\.framework: .*remix/),
      expect.stringMatching(/^coverage\.files_skipped\[0\]\.reason: .*binary/),
    ])
  })

  test('rejects an unknown confidence, precedence or source', () => {
    const agent = asJson(agentFindingsDocument) as Record<string, any>
    agent.checks[0].findings[0].confidence = 'certain'
    agent.checks[0].snapshot.precedence = 'prefer-deterministic'
    expect(translateInvalid(agent)).toEqual([
      expect.stringMatching(/^checks\[0\]\.snapshot\.precedence: /),
      expect.stringMatching(/^checks\[0\]\.findings\[0\]\.confidence: /),
    ])

    const unknownSource = {...(asJson(agentFindingsDocument) as Record<string, unknown>), source: 'human'}
    expect(translateInvalid(unknownSource)).toEqual([expect.stringMatching(/^source: /)])
  })

  test('rejects a wrong or missing schema_version before parsing anything else', () => {
    expect(
      translateInvalid({...(asJson(agentFindingsDocument) as Record<string, unknown>), schema_version: 2}),
    ).toEqual(['unsupported schema_version: 2 (expected 1)'])
    expect(translateInvalid({})).toEqual(['unsupported schema_version: undefined (expected 1)'])
  })

  test('rejects values that are not JSON objects', () => {
    expect(translateInvalid(null)).toEqual(['expected a JSON object, received null'])
    expect(translateInvalid([])).toEqual(['expected a JSON object, received array'])
    expect(translateInvalid('{}')).toEqual(['expected a JSON object, received string'])
  })

  test('reports missing required fields with readable paths', () => {
    const document = asJson(deterministicFindingsDocument) as Record<string, any>
    delete document.generated_at
    delete document.checks[0].snapshot.title
    delete document.checks[0].findings[0].location.file
    document.checks[0].findings[0].evidence = 'none'

    expect(translateInvalid(document)).toEqual([
      expect.stringMatching(/^generated_at: /),
      expect.stringMatching(/^checks\[0\]\.snapshot\.title: /),
      expect.stringMatching(/^checks\[0\]\.findings\[0\]\.location\.file: /),
      expect.stringMatching(/^checks\[0\]\.findings\[0\]\.evidence: /),
    ])
  })

  test.each([
    ['a zero finding line', 'deterministic', 'checks.0.findings.0.location.line', 0, 'Number must be greater than 0'],
    [
      'a fractional finding line',
      'agent',
      'checks.0.findings.0.location.line',
      1.5,
      'Expected integer, received float',
    ],
    [
      'a zero finding column',
      'deterministic',
      'checks.0.findings.0.location.column',
      0,
      'Number must be greater than 0',
    ],
    [
      'a negative evidence line',
      'agent',
      'checks.0.findings.0.evidence.0.location.line',
      -3,
      'Number must be greater than 0',
    ],
    [
      'a fractional evidence column',
      'deterministic',
      'checks.0.findings.0.evidence.0.location.column',
      2.5,
      'Expected integer, received float',
    ],
    ['a docs_url that is not a URL', 'agent', 'checks.0.snapshot.docs_url', 'credential-log-leakage', 'Invalid url'],
    ['a zero check version', 'agent', 'checks.0.version', 0, 'Number must be greater than 0'],
    ['a fractional check version', 'deterministic', 'checks.0.version', 1.5, 'Expected integer, received float'],
    [
      'a negative scanned file count',
      'deterministic',
      'coverage.files_scanned',
      -1,
      'Number must be greater than or equal to 0',
    ],
    [
      'a fractional scanned file count',
      'deterministic',
      'coverage.files_scanned',
      2.5,
      'Expected integer, received float',
    ],
    [
      'a negative skipped file size',
      'deterministic',
      'coverage.files_skipped.0.size_bytes',
      -1,
      'Number must be greater than or equal to 0',
    ],
    [
      'a fractional skipped file size',
      'deterministic',
      'coverage.files_skipped.0.size_bytes',
      0.5,
      'Expected integer, received float',
    ],
  ] as const)('rejects %s (%s document) with its path', (_description, source, path, value, message) => {
    const document = asJson(source === 'deterministic' ? deterministicFindingsDocument : agentFindingsDocument)
    const keys = path.split('.')
    const parent = keys.slice(0, -1).reduce<any>((node, key) => node[key], document)
    parent[keys.at(-1)!] = value

    const errorPath = path.replace(/\.(\d+)/g, '[$1]')
    expect(translateInvalid(document)).toEqual([`${errorPath}: ${message}`])
  })

  test('accepts the smallest line, column, version, count and size that the CLI writes', () => {
    const document = asJson(deterministicFindingsDocument) as Record<string, any>
    document.checks[0].version = 1
    document.checks[0].findings[0].location = {file: 'app/routes/orders.tsx', line: 1, column: 1}
    document.checks[0].findings[0].evidence[0].location = {file: 'app/routes/orders.tsx', line: 1, column: 1}
    document.coverage.files_scanned = 0
    document.coverage.files_skipped[0].size_bytes = 0

    expect(translateFindingsDocument(document)).toEqual({ok: true, document})
  })

  test('rejects a document that records the same check id twice', () => {
    const document = asJson(deterministicFindingsDocument) as Record<string, any>
    const [first, second] = document.checks
    document.checks = [first, second, {...first, findings: []}, second]

    expect(translateInvalid(document)).toEqual([
      `checks[2].id: duplicate check id ${first.id}`,
      `checks[3].id: duplicate check id ${second.id}`,
    ])
  })

  test('requires the deterministic-only sections only on deterministic documents', () => {
    const {detection, coverage, ...withoutDeterministicSections} = asJson(deterministicFindingsDocument) as Record<
      string,
      any
    >
    expect(translateInvalid(withoutDeterministicSections)).toEqual([
      expect.stringMatching(/^detection: /),
      expect.stringMatching(/^coverage: /),
    ])

    const agentWithSections = {...(asJson(agentFindingsDocument) as Record<string, unknown>), detection, coverage}
    expect(translateFindingsDocument(agentWithSections)).toEqual({ok: true, document: agentFindingsDocument})
  })
})
