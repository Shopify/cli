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
