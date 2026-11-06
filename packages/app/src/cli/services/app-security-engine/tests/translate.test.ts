import {agentFindingsDocument, deterministicFindingsDocument} from './fixtures/findings-documents.js'
import {combineFindings} from '../results/combine.js'
import {translateFindingsDocument} from '../results/translate.js'
import {STORED_TYPES_MATCH_SCHEMA_V1} from '../results/schema.js'
import {describe, expect, test} from 'vitest'
import type {AgentFindingsDocument, DeterministicFindingsDocument, FindingsDocument} from '../types.js'

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

  test('accepts an agent suppression with or without a kind, and rejects an unknown kind', () => {
    const checkIndex = agentFindingsDocument.checks.findIndex((check) =>
      check.findings.some((finding) => finding.suppression),
    )
    const findingIndex = agentFindingsDocument.checks[checkIndex]!.findings.findIndex((finding) => finding.suppression)
    const withKind = (kind: unknown) => {
      const agent = asJson(agentFindingsDocument) as Record<string, any>
      agent.checks[checkIndex].findings[findingIndex].suppression.kind = kind
      return agent
    }
    expect(agentFindingsDocument.checks[checkIndex]!.findings[findingIndex]!.suppression).not.toHaveProperty('kind')

    expect(translateFindingsDocument(asJson(agentFindingsDocument))).toEqual({
      ok: true,
      document: agentFindingsDocument,
    })
    expect(translateFindingsDocument(withKind('accepted-risk'))).toEqual({
      ok: true,
      document: withKind('accepted-risk'),
    })
    expect(translateInvalid(withKind('wont_fix'))).toEqual([
      expect.stringContaining(`checks[${checkIndex}].findings[${findingIndex}].suppression.kind: `),
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

  test('accepts code excerpts on findings and evidence', () => {
    const document = asJson(agentFindingsDocument) as Record<string, any>
    document.checks[0].findings[0].code_excerpt = [
      {line: 11, text: 'const orders = await db.order.findMany()'},
      {line: 12, text: ''},
    ]
    document.checks[0].findings[0].evidence[0].code_excerpt = [{line: 12, text: ''}]

    expect(translateFindingsDocument(document)).toEqual({ok: true, document})
  })

  test.each([
    ['a zero excerpt line', 0, 'Number must be greater than 0'],
    ['a fractional excerpt line', 1.5, 'Expected integer, received float'],
  ])('rejects %s', (_description, line, message) => {
    const document = asJson(deterministicFindingsDocument) as Record<string, any>
    document.checks[0].findings[0].code_excerpt = [{line, text: 'console.log(session.accessToken)'}]
    document.checks[0].findings[0].evidence[0].code_excerpt = [{line: 12}]

    expect(translateInvalid(document)).toEqual([
      `checks[0].findings[0].evidence[0].code_excerpt[0].text: Required`,
      `checks[0].findings[0].code_excerpt[0].line: ${message}`,
    ])
  })

  test('parses and combines files without code excerpts, as the current CLI writes them, as before', () => {
    const withExcerpts = (document: FindingsDocument) => ({
      ...document,
      checks: document.checks.map((check) => ({
        ...check,
        findings: check.findings.map((finding) => ({
          ...finding,
          code_excerpt: [{line: finding.location.line ?? 1, text: 'an excerpt'}],
        })),
      })),
    })
    const translated = (document: unknown) => {
      const result = translateFindingsDocument(asJson(document))
      if (!result.ok) throw new Error(result.errors.join('; '))
      return result.document
    }
    const deterministic = translated(deterministicFindingsDocument) as DeterministicFindingsDocument
    const agent = translated(agentFindingsDocument) as AgentFindingsDocument

    expect({deterministic, agent}).toEqual({deterministic: deterministicFindingsDocument, agent: agentFindingsDocument})
    const combined = combineFindings({deterministic, agent}).checks
    const combinedWithExcerpts = combineFindings({
      deterministic: translated(withExcerpts(deterministic)) as DeterministicFindingsDocument,
      agent: translated(withExcerpts(agent)) as AgentFindingsDocument,
    }).checks
    expect(
      combinedWithExcerpts.map((check) => ({
        ...check,
        findings: check.findings.map(({code_excerpt: _excerpt, ...finding}) => finding),
      })),
    ).toEqual(combined)
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
