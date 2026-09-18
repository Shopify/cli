import {APP_SCOPE, LOG_CHECK, WEB_SCOPE, agentResult, staticResult, suppressionFor} from './fixtures/interpretation.js'
import {interpretAppDoctorFindings} from '../interpretation/findings.js'
import {describe, expect, test} from 'vitest'

describe('interpretAppDoctorFindings', () => {
  test('merges a static and an agent observation with one fingerprint into one finding', () => {
    const staticOne = staticResult({findings: [{key: 'token-log', severity: 'medium', points: -10}]})
    const agentOne = agentResult({findings: [{key: 'token-log', severity: 'high'}]})

    const {findings} = interpretAppDoctorFindings([agentOne, staticOne], [])

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding?.fingerprint).toBe(staticOne.findings[0]?.fingerprint)
    expect(finding?.fingerprint).toBe(agentOne.findings[0]?.fingerprint)
    expect(finding?.observations.static).toEqual(staticOne.findings[0])
    expect(finding?.observations.agent).toEqual(agentOne.findings[0])
    // Presentation comes from the static observation; severity is the highest observed.
    expect(finding?.title).toBe('Static title for token-log')
    expect(finding?.message).toBe('Static message for token-log.')
    expect(finding?.fix).toEqual(staticOne.findings[0]?.fix)
    expect(finding?.severity).toBe('high')
    expect(finding?.sources).toEqual(['static', 'agent'])
    expect(finding?.scoring).toEqual({eligible: true, points: -10})
    expect(finding?.scopeIdentity).toBe(APP_SCOPE)
    expect(finding?.code).toBe(LOG_CHECK)
  })

  test.each([
    ['high', 'low', 'high'],
    ['medium', 'low', 'medium'],
    ['low', 'high', 'high'],
  ] as const)('static %s with agent %s reports severity %s', (staticSeverity, agentSeverity, expected) => {
    const results = [
      staticResult({findings: [{key: 'token-log', severity: staticSeverity}]}),
      agentResult({findings: [{key: 'token-log', severity: agentSeverity}]}),
    ]

    const {findings} = interpretAppDoctorFindings(results, [])

    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe(expected)
  })

  test('an agent-only finding presents agent fields and never scores', () => {
    const agentOnly = agentResult({findings: [{key: 'agent-only', points: -50}]})

    const {findings} = interpretAppDoctorFindings([agentOnly], [])

    expect(findings).toHaveLength(1)
    expect(findings[0]?.sources).toEqual(['agent'])
    expect(findings[0]?.title).toBe('Agent title for agent-only')
    expect(findings[0]?.observations.static).toBeUndefined()
    expect(findings[0]?.scoring).toEqual({eligible: false, points: 0})
  })

  test('a static needs_review finding is ineligible', () => {
    const reviewed = staticResult({findings: [{key: 'maybe', confidence: 'needs_review', points: -20}]})

    const {findings} = interpretAppDoctorFindings([reviewed], [])

    expect(findings[0]?.scoring).toEqual({eligible: false, points: 0})
  })

  test('the same key in two scopes stays two findings with distinct fingerprints', () => {
    const inApp = staticResult({scopeIdentity: APP_SCOPE, findings: [{key: 'token-log'}]})
    const inWeb = staticResult({scopeIdentity: WEB_SCOPE, findings: [{key: 'token-log'}]})

    const {findings} = interpretAppDoctorFindings([inWeb, inApp], [])

    expect(findings).toHaveLength(2)
    expect(findings.map((finding) => finding.scopeIdentity)).toEqual([APP_SCOPE, WEB_SCOPE])
    expect(new Set(findings.map((finding) => finding.fingerprint)).size).toBe(2)
    expect(findings.every((finding) => finding.scoring.eligible)).toBe(true)
  })

  test('sorts by scope identity, code, then fingerprint', () => {
    const results = [
      staticResult({scopeIdentity: WEB_SCOPE, checkId: 'A_CHECK', findings: [{key: 'k'}]}),
      staticResult({scopeIdentity: APP_SCOPE, checkId: 'B_CHECK', findings: [{key: 'k'}]}),
      staticResult({scopeIdentity: APP_SCOPE, checkId: 'A_CHECK', findings: [{key: 'z'}, {key: 'y'}]}),
    ]

    const {findings} = interpretAppDoctorFindings(results, [])

    expect(findings.map((finding) => [finding.scopeIdentity, finding.code])).toEqual([
      [APP_SCOPE, 'A_CHECK'],
      [APP_SCOPE, 'A_CHECK'],
      [APP_SCOPE, 'B_CHECK'],
      [WEB_SCOPE, 'A_CHECK'],
    ])
    // The two APP_SCOPE/A_CHECK findings tie on scope and code, so fingerprint breaks the tie.
    const [first, second] = findings
    expect((first?.fingerprint ?? '').localeCompare(second?.fingerprint ?? '')).toBeLessThan(0)
  })

  test('a matching suppression marks the finding but keeps its scoring', () => {
    const result = staticResult({findings: [{key: 'token-log', points: -15}]})
    const fingerprint = result.findings[0]?.fingerprint ?? ''
    const suppression = suppressionFor(fingerprint)

    const {findings, suppressions} = interpretAppDoctorFindings([result], [suppression])

    expect(findings[0]?.suppressed).toBe(true)
    expect(findings[0]?.suppression).toEqual({
      id: suppression.id,
      justification: suppression.justification,
      provenance: suppression.provenance,
    })
    expect(findings[0]?.scoring).toEqual({eligible: true, points: -15})
    expect(suppressions).toEqual({matched: 1, suppressedFindings: 1, unmatched: []})
  })

  test('two suppressions for one fingerprint attach the first, count both as matched, and suppress one finding', () => {
    const result = staticResult({findings: [{key: 'token-log'}]})
    const fingerprint = result.findings[0]?.fingerprint ?? ''

    const {findings, suppressions} = interpretAppDoctorFindings(
      [result],
      [suppressionFor(fingerprint, 'first'), suppressionFor(fingerprint, 'second')],
    )

    expect(findings[0]?.suppression?.id).toBe('first')
    expect(suppressions).toEqual({matched: 2, suppressedFindings: 1, unmatched: []})
  })

  test('reports unmatched suppressions without dropping them', () => {
    const result = staticResult({findings: [{key: 'token-log'}]})
    const stale = suppressionFor(`sha256:${'f'.repeat(64)}`, 'stale')

    const {findings, suppressions} = interpretAppDoctorFindings([result], [stale])

    expect(findings[0]?.suppressed).toBe(false)
    expect(findings[0]?.suppression).toBeUndefined()
    expect(suppressions).toEqual({matched: 0, suppressedFindings: 0, unmatched: [stale]})
  })

  test('no findings yields empty output', () => {
    expect(interpretAppDoctorFindings([staticResult(), agentResult()], [])).toEqual({
      findings: [],
      suppressions: {matched: 0, suppressedFindings: 0, unmatched: []},
    })
  })
})
