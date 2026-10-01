import {agentFindingsDocument, deterministicFindingsDocument} from './fixtures/findings-documents.js'
import {
  activeFindings,
  checkGeneratedAt,
  combineFindings,
  isAgentResultStale,
  isCheckPassed,
  isSuppressed,
  summarizeCombinedChecks,
  type CombinedCheck,
} from '../results/combine.js'
import {describe, expect, test} from 'vitest'
import type {
  AgentFindingsDocument,
  CheckPrecedence,
  DeterministicFindingsDocument,
  StoredCheck,
  StoredCheckStatus,
  StoredFinding,
} from '../types.js'

const STATUSES: StoredCheckStatus[] = ['executed', 'not_applicable', 'unresolved']
/** Two recording times, for the staleness tests. */
const OLDER = '2026-09-01T10:00:00.000Z'
const NEWER = '2026-09-01T11:30:00.000Z'

function finding(overrides: Partial<StoredFinding> = {}): StoredFinding {
  return {
    location: {file: 'app/routes/orders.tsx', line: 12},
    message: 'A finding.',
    evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}}],
    ...overrides,
  }
}

function check(overrides: Partial<StoredCheck> & {precedence?: CheckPrecedence} = {}): StoredCheck {
  const {precedence, snapshot, ...rest} = overrides
  return {
    id: 'CHECK',
    version: 1,
    status: 'executed',
    snapshot: {
      title: 'A check',
      severity: 'medium',
      description: 'Describes the check.',
      current_version: 1,
      ...(precedence ? {precedence} : {}),
      ...snapshot,
    },
    findings: [],
    ...rest,
  }
}

function deterministicDocument(checks: StoredCheck[], generatedAt?: string): DeterministicFindingsDocument {
  return {...deterministicFindingsDocument, ...(generatedAt ? {generated_at: generatedAt} : {}), checks}
}

function agentDocument(checks: StoredCheck[], generatedAt?: string): AgentFindingsDocument {
  return {...agentFindingsDocument, ...(generatedAt ? {generated_at: generatedAt} : {}), checks}
}

/** The documents' `generated_at`, overridable per source; the fixture agent document is the newer one. */
interface GeneratedAt {
  deterministic?: string
  agent?: string
}

function combineOne(
  deterministic: StoredCheck | null,
  agent: StoredCheck | null,
  generatedAt: GeneratedAt = {},
): CombinedCheck {
  const combined = combineFindings({
    deterministic: deterministic ? deterministicDocument([deterministic], generatedAt.deterministic) : null,
    agent: agent ? agentDocument([agent], generatedAt.agent) : null,
  })
  expect(combined).toHaveLength(1)
  return combined[0]!
}

describe('combineFindings', () => {
  test('returns no checks when both documents are missing', () => {
    expect(combineFindings({deterministic: null, agent: null})).toEqual([])
  })

  describe('combined status', () => {
    test.each<[StoredCheckStatus | null, StoredCheckStatus | null, StoredCheckStatus]>([
      // Only one source recorded the check.
      ['executed', null, 'executed'],
      ['not_applicable', null, 'not_applicable'],
      ['unresolved', null, 'unresolved'],
      [null, 'executed', 'executed'],
      [null, 'not_applicable', 'not_applicable'],
      [null, 'unresolved', 'unresolved'],
      // Both sources: a pass from either counts as a pass, then unresolved wins over not_applicable.
      ['executed', 'executed', 'executed'],
      ['executed', 'not_applicable', 'executed'],
      ['executed', 'unresolved', 'executed'],
      ['not_applicable', 'executed', 'executed'],
      ['not_applicable', 'not_applicable', 'not_applicable'],
      ['not_applicable', 'unresolved', 'unresolved'],
      ['unresolved', 'executed', 'executed'],
      ['unresolved', 'not_applicable', 'unresolved'],
      ['unresolved', 'unresolved', 'unresolved'],
    ])('union: deterministic %s + agent %s → %s', (deterministicStatus, agentStatus, expected) => {
      const combined = combineOne(
        deterministicStatus ? check({status: deterministicStatus}) : null,
        agentStatus ? check({status: agentStatus, precedence: 'union'}) : null,
      )

      expect(combined.status).toBe(expected)
      expect(combined.precedence).toBe('union')
    })

    test.each(
      STATUSES.flatMap((deterministicStatus) => STATUSES.map((agentStatus) => [deterministicStatus, agentStatus])),
    )('prefer-agent: deterministic %s + agent %s → the agent status', (deterministicStatus, agentStatus) => {
      const combined = combineOne(
        check({status: deterministicStatus}),
        check({status: agentStatus, precedence: 'prefer-agent'}),
      )

      expect(combined.status).toBe(agentStatus)
      expect(combined.precedence).toBe('prefer-agent')
    })

    test.each(STATUSES)('prefer-agent with only the agent: %s is the agent status', (agentStatus) => {
      const combined = combineOne(null, check({status: agentStatus, precedence: 'prefer-agent'}))

      expect(combined.status).toBe(agentStatus)
      expect(combined.precedence).toBe('prefer-agent')
      expect(combined.by_source.deterministic).toBeNull()
    })

    test('defaults the precedence to union when the agent snapshot has none', () => {
      const combined = combineOne(check({status: 'executed'}), check({status: 'not_applicable'}))

      expect(combined.precedence).toBe('union')
      expect(combined.status).toBe('executed')
    })
  })

  describe('stale agent results', () => {
    const deterministicFinding = finding({message: 'Deterministic finding.'})
    const agentFinding = finding({message: 'Agent finding.'})
    const preferAgent = (status: StoredCheckStatus = 'executed'): StoredCheck =>
      check({status, precedence: 'prefer-agent', findings: status === 'executed' ? [agentFinding] : []})

    test('falls back to union when the agent result is older than the deterministic result', () => {
      const combined = combineOne(check({findings: [deterministicFinding]}), preferAgent(), {
        deterministic: NEWER,
        agent: OLDER,
      })

      expect(combined.precedence).toBe('prefer-agent')
      expect(combined.applied_precedence).toBe('union')
      expect(isAgentResultStale(combined)).toBe(true)
      expect(combined.findings.map(({source, disposition}) => ({source, disposition}))).toEqual([
        {source: 'deterministic', disposition: 'active'},
        {source: 'agent', disposition: 'active'},
      ])
      expect(combined.by_source).toMatchObject({
        deterministic: {generated_at: NEWER},
        agent: {generated_at: OLDER},
      })
    })

    test('uses the union status when the agent result is stale', () => {
      const combined = combineOne(check({status: 'executed'}), preferAgent('not_applicable'), {
        deterministic: NEWER,
        agent: OLDER,
      })

      expect(combined.status).toBe('executed')
      expect(combined.applied_precedence).toBe('union')
    })

    test.each([
      ['equal', {deterministic: OLDER, agent: OLDER}],
      ['newer', {deterministic: OLDER, agent: NEWER}],
    ])('applies prefer-agent when the agent result is %s', (_, generatedAt) => {
      const combined = combineOne(check({findings: [deterministicFinding]}), preferAgent('unresolved'), generatedAt)

      expect(combined.applied_precedence).toBe('prefer-agent')
      expect(isAgentResultStale(combined)).toBe(false)
      expect(combined.status).toBe('unresolved')
      expect(combined.findings.map((item) => item.disposition)).toEqual(['superseded'])
    })

    test('applies prefer-agent when the deterministic source did not record the check', () => {
      const combined = combineOne(null, preferAgent(), {agent: OLDER})

      expect(combined.applied_precedence).toBe('prefer-agent')
      expect(isAgentResultStale(combined)).toBe(false)
    })

    test.each([
      ['deterministic', {deterministic: 'not a time', agent: NEWER}],
      ['agent', {deterministic: OLDER, agent: 'not a time'}],
      ['both', {deterministic: 'not a time', agent: 'not a time'}],
    ])('counts an unparseable %s time as stale', (_, generatedAt) => {
      const combined = combineOne(check({findings: [deterministicFinding]}), preferAgent(), generatedAt)

      expect(combined.applied_precedence).toBe('union')
      expect(isAgentResultStale(combined)).toBe(true)
      expect(combined.findings.map((item) => item.disposition)).toEqual(['active', 'active'])
    })

    test.each([
      ['older', {deterministic: NEWER, agent: OLDER}],
      ['newer', {deterministic: OLDER, agent: NEWER}],
    ])('leaves a union check unaffected when the agent result is %s', (_, generatedAt) => {
      const unionCheck = check({precedence: 'union', findings: [agentFinding]})
      const combined = combineOne(check({findings: [deterministicFinding]}), unionCheck, generatedAt)

      expect(combined.precedence).toBe('union')
      expect(combined.applied_precedence).toBe('union')
      expect(isAgentResultStale(combined)).toBe(false)
      expect(combined.findings.map((item) => item.disposition)).toEqual(['active', 'active'])
    })

    test('is never stale without an agent check', () => {
      const combined = combineOne(check({findings: [deterministicFinding]}), null)

      expect(combined.applied_precedence).toBe('union')
      expect(isAgentResultStale(combined)).toBe(false)
    })
  })

  describe('dispositions', () => {
    const deterministicFinding = finding({message: 'Deterministic finding.'})
    const agentFinding = finding({message: 'Agent finding.'})
    const suppressedFinding = finding({message: 'Suppressed finding.', suppression: {justification: 'Reviewed.'}})

    test('union keeps both sources: deterministic findings are active, agent findings are active or suppressed', () => {
      const combined = combineOne(
        check({findings: [deterministicFinding]}),
        check({precedence: 'union', findings: [agentFinding, suppressedFinding]}),
      )

      expect(combined.findings.map(({source, disposition, message}) => ({source, disposition, message}))).toEqual([
        {source: 'deterministic', disposition: 'active', message: 'Deterministic finding.'},
        {source: 'agent', disposition: 'active', message: 'Agent finding.'},
        {source: 'agent', disposition: 'suppressed', message: 'Suppressed finding.'},
      ])
    })

    test('a suppression on a deterministic finding is ignored: the finding stays active', () => {
      const combined = combineOne(
        check({findings: [finding({suppression: {justification: 'Hand-edited.'}})]}),
        check({precedence: 'union'}),
      )

      expect(combined.findings.map((item) => item.disposition)).toEqual(['active'])
      expect(summarizeCombinedChecks([combined]).suppressed).toBe(0)
    })

    test('a single source keeps its findings active, suppressed when the agent suppressed them', () => {
      expect(
        combineOne(check({findings: [deterministicFinding]}), null).findings.map((item) => item.disposition),
      ).toEqual(['active'])
      expect(
        combineOne(null, check({findings: [agentFinding, suppressedFinding]})).findings.map((item) => item.disposition),
      ).toEqual(['active', 'suppressed'])
    })

    test.each(STATUSES)('prefer-agent supersedes every deterministic finding when the agent is %s', (agentStatus) => {
      const combined = combineOne(
        check({findings: [deterministicFinding, finding({message: 'Another deterministic finding.'})]}),
        check({
          precedence: 'prefer-agent',
          status: agentStatus,
          ...(agentStatus === 'not_applicable'
            ? {reason: {code: 'capability_absent', message: 'Not relevant.'}}
            : {findings: [agentFinding, suppressedFinding]}),
        }),
      )

      const deterministicDispositions = combined.findings
        .filter((item) => item.source === 'deterministic')
        .map((item) => item.disposition)
      expect(deterministicDispositions).toEqual(['superseded', 'superseded'])
      const agentDispositions = combined.findings
        .filter((item) => item.source === 'agent')
        .map((item) => item.disposition)
      expect(agentDispositions).toEqual(agentStatus === 'not_applicable' ? [] : ['active', 'suppressed'])
    })

    test('keeps every stored field of a finding', () => {
      const stored = finding({
        snippet: 'console.log(token)',
        confidence: 'high',
        reasoning: 'The token is live.',
        fix: {automated: false, description: 'Remove the log.'},
      })

      const [combined] = combineOne(null, check({findings: [stored]})).findings

      expect(combined).toEqual({...stored, source: 'agent', disposition: 'active'})
    })
  })

  describe('check metadata', () => {
    const deterministicCheck = check({
      version: 2,
      status: 'unresolved',
      reason: {code: 'parser_unavailable', message: 'No parser.'},
      analysis_mode: 'ast',
      snapshot: {
        title: 'Deterministic title',
        severity: 'low',
        description: 'Deterministic description.',
        guide: 'https://example.com/deterministic',
        current_version: 2,
      },
    })
    const agentCheck = check({
      version: 3,
      status: 'not_applicable',
      reason: {code: 'no_routes', message: 'No routes.'},
      snapshot: {
        title: 'Agent title',
        severity: 'high',
        description: 'Agent description.',
        guide: 'https://example.com/agent',
        current_version: 3,
      },
    })

    test.each<CheckPrecedence>(['union', 'prefer-agent'])(
      'takes title, severity, description and guide from the agent snapshot under %s',
      (precedence) => {
        const combined = combineOne(deterministicCheck, {
          ...agentCheck,
          snapshot: {...agentCheck.snapshot, precedence},
        })

        expect(combined).toMatchObject({
          id: 'CHECK',
          title: 'Agent title',
          severity: 'high',
          description: 'Agent description.',
          guide: 'https://example.com/agent',
        })
      },
    )

    test('takes title, severity, description and guide from the deterministic snapshot without an agent check', () => {
      const combined = combineOne(deterministicCheck, null)

      expect(combined).toMatchObject({
        id: 'CHECK',
        title: 'Deterministic title',
        severity: 'low',
        description: 'Deterministic description.',
        guide: 'https://example.com/deterministic',
      })
    })

    test('omits guide when the snapshot has none', () => {
      const combined = combineOne(check(), null)

      expect('guide' in combined).toBe(false)
    })

    test("by_source keeps each source's own result and null for a source that didn't record the check", () => {
      expect(combineOne(deterministicCheck, agentCheck).by_source).toEqual({
        deterministic: {
          version: 2,
          status: 'unresolved',
          reason: {code: 'parser_unavailable', message: 'No parser.'},
          analysis_mode: 'ast',
          generated_at: deterministicFindingsDocument.generated_at,
        },
        agent: {
          version: 3,
          status: 'not_applicable',
          reason: {code: 'no_routes', message: 'No routes.'},
          generated_at: agentFindingsDocument.generated_at,
        },
      })
      expect(combineOne(deterministicCheck, null).by_source.agent).toBeNull()
      expect(combineOne(null, agentCheck).by_source.deterministic).toBeNull()
      expect(combineOne(null, check()).by_source.agent).toStrictEqual({
        version: 1,
        status: 'executed',
        generated_at: agentFindingsDocument.generated_at,
      })
    })
  })

  describe('isSuppressed', () => {
    const suppressed = finding({suppression: {justification: 'Reviewed.'}})

    test('is true only for an agent finding with a suppression', () => {
      expect(isSuppressed(suppressed, 'agent')).toBe(true)
      expect(isSuppressed(finding(), 'agent')).toBe(false)
      expect(isSuppressed(suppressed, 'deterministic')).toBe(false)
      expect(isSuppressed(finding(), 'deterministic')).toBe(false)
    })
  })

  describe('checkGeneratedAt', () => {
    test("is the document's generated_at", () => {
      expect(checkGeneratedAt(check(), {generated_at: NEWER})).toBe(NEWER)
    })
  })

  describe('canonical ordering', () => {
    test('orders checks by severity then id, whichever source recorded them', () => {
      const combined = combineFindings({
        deterministic: deterministicDocument([
          check({id: 'Z_LOW', snapshot: {title: 'Z', severity: 'low', description: 'Z.', current_version: 1}}),
          check({id: 'B_HIGH', snapshot: {title: 'B', severity: 'high', description: 'B.', current_version: 1}}),
          check({id: 'M_MEDIUM', snapshot: {title: 'M', severity: 'medium', description: 'M.', current_version: 1}}),
        ]),
        agent: agentDocument([
          check({id: 'A_HIGH', snapshot: {title: 'A', severity: 'high', description: 'A.', current_version: 1}}),
          check({id: 'A_LOW', snapshot: {title: 'A', severity: 'low', description: 'A.', current_version: 1}}),
          // The agent's severity wins for a check both sources recorded.
          check({id: 'M_MEDIUM', snapshot: {title: 'M', severity: 'high', description: 'M.', current_version: 1}}),
        ]),
      })

      expect(combined.map((item) => item.id)).toEqual(['A_HIGH', 'B_HIGH', 'M_MEDIUM', 'A_LOW', 'Z_LOW'])
    })

    test('orders findings by file, line with missing first, deterministic before agent, then message', () => {
      const combined = combineOne(
        check({
          findings: [
            finding({location: {file: 'b.ts', line: 5}, message: 'deterministic b:5'}),
            finding({location: {file: 'a.ts', line: 9}, message: 'deterministic a:9'}),
            finding({location: {file: 'a.ts'}, message: 'deterministic a'}),
            finding({location: {file: 'a.ts', line: 9}, message: 'deterministic a:9 (another)'}),
          ],
        }),
        check({
          precedence: 'union',
          findings: [
            finding({location: {file: 'a.ts', line: 9}, message: 'agent a:9'}),
            finding({location: {file: 'a.ts', line: 2}, message: 'agent a:2'}),
            finding({location: {file: 'b.ts', line: 5}, message: 'agent b:5'}),
          ],
        }),
      )

      expect(combined.findings.map((item) => item.message)).toEqual([
        'deterministic a',
        'agent a:2',
        'deterministic a:9',
        'deterministic a:9 (another)',
        'agent a:9',
        'deterministic b:5',
        'agent b:5',
      ])
    })

    test('orders a finding without a line before one at line 0', () => {
      const combined = combineOne(
        check({
          findings: [
            finding({location: {file: 'a.ts', line: 0}, message: 'a:0'}),
            finding({location: {file: 'a.ts'}, message: 'z (no line)'}),
          ],
        }),
        null,
      )

      expect(combined.findings.map((item) => item.message)).toEqual(['z (no line)', 'a:0'])
    })
  })

  test('an agent unresolved check keeps its findings active', () => {
    const combined = combineOne(
      null,
      check({
        status: 'unresolved',
        reason: {code: 'needs_runtime', message: 'Could not trace statically.'},
        findings: [finding()],
      }),
    )

    expect(combined.status).toBe('unresolved')
    expect(combined.findings.map((item) => item.disposition)).toEqual(['active'])
    expect(activeFindings(combined)).toHaveLength(1)
    expect(isCheckPassed(combined)).toBe(false)
  })

  test('combines the shared fixtures with every check from either source', () => {
    const combined = combineFindings({deterministic: deterministicFindingsDocument, agent: agentFindingsDocument})

    expect(
      combined.map((item) => [item.id, item.severity, item.precedence, item.applied_precedence, item.status]),
    ).toEqual([
      ['CREDENTIAL_LOG_LEAKAGE', 'high', 'prefer-agent', 'prefer-agent', 'executed'],
      ['MISSING_TENANT_ISOLATION', 'high', 'union', 'union', 'executed'],
      ['UNAUTHENTICATED_ENDPOINT', 'high', 'union', 'union', 'unresolved'],
      ['UNSAFE_INNERHTML', 'high', 'union', 'union', 'not_applicable'],
      ['OPEN_REDIRECT', 'medium', 'union', 'union', 'executed'],
      ['EOL_API_VERSION', 'low', 'union', 'union', 'executed'],
    ])
    const credentialLeak = combined.find((item) => item.id === 'CREDENTIAL_LOG_LEAKAGE')!
    expect(credentialLeak.findings.map(({source, disposition}) => ({source, disposition}))).toEqual([
      {source: 'deterministic', disposition: 'superseded'},
      {source: 'agent', disposition: 'active'},
      {source: 'deterministic', disposition: 'superseded'},
    ])
  })
})

describe('derived states', () => {
  const activeFinding = finding({message: 'Active.'})
  const suppressedFinding = finding({message: 'Suppressed.', suppression: {justification: 'Reviewed.'}})

  test('activeFindings returns only the active findings', () => {
    const combined = combineOne(
      check({findings: [activeFinding]}),
      check({precedence: 'union', findings: [suppressedFinding]}),
    )

    expect(activeFindings(combined).map((item) => item.message)).toEqual(['Active.'])
  })

  test('isCheckPassed is true only for an executed check with no active findings', () => {
    expect(isCheckPassed(combineOne(check(), null))).toBe(true)
    expect(isCheckPassed(combineOne(null, check({findings: [suppressedFinding]})))).toBe(true)
    expect(
      isCheckPassed(combineOne(check({findings: [activeFinding]}), check({precedence: 'prefer-agent', findings: []}))),
    ).toBe(true)
    expect(isCheckPassed(combineOne(check({findings: [activeFinding]}), null))).toBe(false)
    expect(isCheckPassed(combineOne(check({status: 'not_applicable'}), null))).toBe(false)
    expect(isCheckPassed(combineOne(check({status: 'unresolved'}), null))).toBe(false)
  })

  test('summarizeCombinedChecks partitions checks and counts suppressed and superseded findings', () => {
    const checks = combineFindings({
      deterministic: deterministicDocument([
        check({id: 'WITH_FINDINGS', findings: [activeFinding]}),
        check({id: 'PASSED'}),
        check({id: 'SUPERSEDED', findings: [activeFinding, finding({message: 'Also superseded.'})]}),
        check({id: 'NOT_APPLICABLE', status: 'not_applicable'}),
        check({id: 'UNRESOLVED_WITH_FINDINGS', status: 'unresolved'}),
      ]),
      agent: agentDocument([
        check({id: 'SUPERSEDED', precedence: 'prefer-agent', findings: [suppressedFinding]}),
        check({id: 'UNRESOLVED', status: 'unresolved', precedence: 'union'}),
        check({id: 'UNRESOLVED_WITH_FINDINGS', status: 'unresolved', findings: [activeFinding]}),
        check({id: 'SUPPRESSED_ONLY', findings: [suppressedFinding]}),
      ]),
    })

    expect(summarizeCombinedChecks(checks)).toEqual({
      withFindings: 2,
      passed: 3,
      notApplicable: 1,
      unresolved: 1,
      suppressed: 2,
      superseded: 2,
    })
  })

  test('summarizeCombinedChecks is all zeros for no checks', () => {
    expect(summarizeCombinedChecks([])).toEqual({
      withFindings: 0,
      passed: 0,
      notApplicable: 0,
      unresolved: 0,
      suppressed: 0,
      superseded: 0,
    })
  })
})
