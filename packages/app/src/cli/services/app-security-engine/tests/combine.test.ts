import {agentFindingsDocument, deterministicFindingsDocument} from './fixtures/findings-documents.js'
import {
  activeFindings,
  combineFindings,
  isAgentResultStale,
  isCheckPassed,
  summarizeCombinedChecks,
  type CombinedCheck,
} from '../results/combine.js'
import {describe, expect, test} from 'vitest'
import type {SuppressionEntry, SuppressionEntryResult} from '../results/suppressions.js'
import type {
  AgentFindingsDocument,
  CheckPrecedence,
  CodeExcerptLine,
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

/** Consecutive lines from `firstLine`, as `check` and `record` capture them. */
function excerpt(firstLine: number, ...texts: string[]): CodeExcerptLine[] {
  return texts.map((text, index) => ({line: firstLine + index, text}))
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
  const {checks} = combineFindings({
    deterministic: deterministic ? deterministicDocument([deterministic], generatedAt.deterministic) : null,
    agent: agent ? agentDocument([agent], generatedAt.agent) : null,
  })
  expect(checks).toHaveLength(1)
  return checks[0]!
}

describe('combineFindings', () => {
  test('returns no checks and no suppressions when both documents are missing', () => {
    expect(combineFindings({deterministic: null, agent: null})).toEqual({checks: [], suppressions: []})
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
        docs_url: 'https://example.com/deterministic-docs',
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
        docs_url: 'https://example.com/agent-docs',
        current_version: 3,
      },
    })

    test.each<CheckPrecedence>(['union', 'prefer-agent'])(
      'takes title, severity, description, guide and docs URL from the agent snapshot under %s',
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
          docs_url: 'https://example.com/agent-docs',
        })
      },
    )

    test('takes title, severity, description, guide and docs URL from the deterministic snapshot without an agent check', () => {
      const combined = combineOne(deterministicCheck, null)

      expect(combined).toMatchObject({
        id: 'CHECK',
        title: 'Deterministic title',
        severity: 'low',
        description: 'Deterministic description.',
        guide: 'https://example.com/deterministic',
        docs_url: 'https://example.com/deterministic-docs',
      })
    })

    test('omits guide and docs URL when the snapshot has neither', () => {
      const combined = combineOne(check(), null)

      expect('guide' in combined).toBe(false)
      expect('docs_url' in combined).toBe(false)
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

  describe('suppressions', () => {
    const path = 'app/routes/orders.tsx'
    const loader = [
      'export async function loader({request}) {',
      '  const {session} = await authenticate.admin(request)',
      '  console.log(session.accessToken)',
      '  return null',
      '}',
    ]
    const loggedToken = finding({
      location: {file: path, line: 12},
      message: 'accessToken flows into console.log.',
      evidence: [{location: {file: path, line: 12}}],
      code_excerpt: excerpt(10, ...loader),
    })
    const loggedOrder = finding({
      location: {file: path, line: 30},
      message: 'An order flows into console.log.',
      evidence: [{location: {file: path, line: 30}}],
      code_excerpt: excerpt(28, '', '  const order = await loadOrder(request)', '  console.log(order)', '}', ''),
    })

    function entry(overrides: Partial<SuppressionEntry> = {}): SuppressionEntry {
      return {
        source: 'deterministic',
        check: 'CHECK',
        kind: 'false-positive',
        path,
        reason: 'Reviewed with the security team.',
        ...overrides,
      }
    }

    function combineWith(
      entries: SuppressionEntry[],
      sources: {deterministic?: StoredCheck[]; agent?: StoredCheck[]; missingPaths?: string[]},
    ) {
      return combineFindings({
        deterministic: sources.deterministic ? deterministicDocument(sources.deterministic) : null,
        agent: sources.agent ? agentDocument(sources.agent) : null,
        suppressions: {
          entries,
          ...(sources.missingPaths ? {missingPaths: sources.missingPaths} : {}),
        },
      })
    }

    const dispositions = (checks: CombinedCheck[]) =>
      checks.flatMap((item) => item.findings.map(({message, disposition}) => ({message, disposition})))
    const statuses = (results: SuppressionEntryResult[]) =>
      results.map(({status, matched_finding_count: count}) => ({status, count}))

    test('an entry suppresses the deterministic finding whose flagged line holds its code, with its kind and reason', () => {
      const suppression = entry({kind: 'accepted-risk', code: 'console.log(session.accessToken)'})

      const {checks, suppressions} = combineWith([suppression], {
        deterministic: [check({findings: [loggedToken, loggedOrder]})],
      })

      expect(
        checks[0]!.findings.map(({disposition, suppressed_by: suppressedBy}) => ({disposition, suppressedBy})),
      ).toEqual([
        {
          disposition: 'suppressed',
          suppressedBy: {
            origin: 'file',
            entry_index: 0,
            kind: 'accepted-risk',
            reason: 'Reviewed with the security team.',
          },
        },
        {disposition: 'active', suppressedBy: undefined},
      ])
      expect(suppressions).toEqual([{index: 0, entry: suppression, status: 'matched', matched_finding_count: 1}])
      expect(summarizeCombinedChecks(checks)).toMatchObject({withFindings: 1, suppressed: 1})
    })

    test('the same rule suppresses agent findings', () => {
      const {checks, suppressions} = combineWith([entry({source: 'agent', code: 'console.log(order)'})], {
        deterministic: [check({findings: [loggedOrder]})],
        agent: [check({precedence: 'union', findings: [loggedToken, loggedOrder]})],
      })

      expect(checks[0]!.findings.map(({source, disposition}) => ({source, disposition}))).toEqual([
        {source: 'agent', disposition: 'active'},
        {source: 'deterministic', disposition: 'active'},
        {source: 'agent', disposition: 'suppressed'},
      ])
      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test('ignores whitespace, commas and semicolons, and treats every quote alike', () => {
      const logged = finding({
        location: {file: path, line: 3},
        code_excerpt: excerpt(
          1,
          'import {logger} from "~/logger"',
          '',
          `  logger.info('token',  session.accessToken);`,
        ),
      })

      const {suppressions} = combineWith([entry({code: 'logger.info(`token`session.accessToken)'})], {
        deterministic: [check({findings: [logged]})],
      })

      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test('matches a statement that a reformat split around the flagged line, but not a neighboring line alone', () => {
      const split = finding({
        location: {file: path, line: 11},
        code_excerpt: excerpt(
          9,
          'const headers = {',
          "  'X-Shopify-Access-Token':",
          '    session.accessToken,',
          '}',
          'await fetch(url, {headers})',
        ),
      })
      const deterministic = [check({findings: [split]})]

      const across = combineWith([entry({code: '"X-Shopify-Access-Token": session.accessToken'})], {deterministic})
      const neighbor = combineWith([entry({code: 'await fetch(url, {headers})'})], {deterministic})

      expect(statuses(across.suppressions)).toEqual([{status: 'matched', count: 1}])
      expect(statuses(neighbor.suppressions)).toEqual([{status: 'stale', count: 0}])
    })

    test('an entry still matches after unrelated lines are inserted above the finding', () => {
      const suppression = entry({code: 'console.log(session.accessToken)'})
      const moved = finding({...loggedToken, location: {file: path, line: 17}, code_excerpt: excerpt(15, ...loader)})

      const before = combineWith([suppression], {deterministic: [check({findings: [loggedToken]})]})
      const after = combineWith([suppression], {deterministic: [check({findings: [moved]})]})

      expect(dispositions(before.checks)).toEqual([{message: loggedToken.message, disposition: 'suppressed'}])
      expect(dispositions(after.checks)).toEqual([{message: loggedToken.message, disposition: 'suppressed'}])
      expect(statuses(after.suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test("matches an evidence line in the finding's file, but not one in another file", () => {
      const forwarded = (evidenceFile: string) =>
        finding({
          location: {file: path, line: 40},
          code_excerpt: excerpt(40, '  return sync(order)'),
          evidence: [
            {
              location: {file: evidenceFile, line: 8},
              code_excerpt: excerpt(8, "  headers: {'X-Shopify-Access-Token': token},"),
            },
          ],
        })
      const suppression = entry({code: "'X-Shopify-Access-Token': token"})

      const sameFile = combineWith([suppression], {deterministic: [check({findings: [forwarded(path)]})]})
      const otherFile = combineWith([suppression], {
        deterministic: [check({findings: [forwarded('app/sync.server.ts')]})],
      })

      expect(statuses(sameFile.suppressions)).toEqual([{status: 'matched', count: 1}])
      expect(statuses(otherFile.suppressions)).toEqual([{status: 'stale', count: 0}])
    })

    test('matches a finding without an excerpt by its message', () => {
      const withoutLine = finding({
        location: {file: 'shopify.app.toml'},
        message: 'The app does not subscribe to customers/redact.',
        evidence: [],
      })
      const inSecretFile = finding({location: {file: '.env', line: 2}, message: 'A Shopify access token is committed.'})

      const {checks, suppressions} = combineWith(
        [
          entry({path: 'shopify.app.toml', code: 'customers/redact'}),
          entry({path: '.env', code: 'Shopify access token'}),
        ],
        {deterministic: [check({findings: [withoutLine, inSecretFile]})]},
      )

      expect(dispositions(checks).map(({disposition}) => disposition)).toEqual(['suppressed', 'suppressed'])
      expect(statuses(suppressions)).toEqual([
        {status: 'matched', count: 1},
        {status: 'matched', count: 1},
      ])
    })

    test("doesn't match a finding with captured code by its message alone", () => {
      // Deterministic messages are fixed per rule, so an entry written for one finding would hide another one.
      const message = 'A non-literal value is written to an HTML, script, or evaluation sink.'
      const written = finding({
        location: {file: path, line: 40},
        message,
        code_excerpt: excerpt(40, '  banner.innerHTML = params.get("html")'),
      })
      const forwarded = finding({
        location: {file: path, line: 50},
        message,
        evidence: [{location: {file: path, line: 52}, code_excerpt: excerpt(52, '  banner.innerHTML = html')}],
      })

      for (const coded of [written, forwarded]) {
        const {checks, suppressions} = combineWith([entry({code: 'value'})], {
          deterministic: [check({findings: [coded]})],
        })

        expect(dispositions(checks)).toEqual([{message, disposition: 'active'}])
        expect(statuses(suppressions)).toEqual([{status: 'stale', count: 0}])
      }
    })

    test("a match in one finding's code isn't made ambiguous by the message of another finding with code", () => {
      const loggedValue = finding({
        location: {file: path, line: 10},
        message: 'A token is logged.',
        code_excerpt: excerpt(10, '  console.log(value)'),
      })
      const mentionsValue = finding({
        location: {file: path, line: 30},
        message: 'A value reaches a log.',
        code_excerpt: excerpt(30, '  console.log(order)'),
      })

      const {checks, suppressions} = combineWith([entry({code: 'value'})], {
        deterministic: [check({findings: [loggedValue, mentionsValue]})],
      })

      expect(dispositions(checks)).toEqual([
        {message: 'A token is logged.', disposition: 'suppressed'},
        {message: 'A value reaches a log.', disposition: 'active'},
      ])
      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test('an entry without code suppresses every finding of its check in its file, and nothing else', () => {
      const elsewhere = finding({location: {file: 'app/routes/other.tsx', line: 3}, message: 'Elsewhere.'})

      const {checks, suppressions} = combineWith([entry()], {
        deterministic: [
          check({findings: [loggedToken, loggedOrder, elsewhere]}),
          check({id: 'OTHER', findings: [loggedToken]}),
        ],
      })

      expect(checks.map((item) => [item.id, item.findings.map(({disposition}) => disposition)])).toEqual([
        ['CHECK', ['suppressed', 'suppressed', 'active']],
        ['OTHER', ['active']],
      ])
      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 2}])
    })

    test('when code matches several findings, keeps the one with the text in both its code and its message', () => {
      const scopes = excerpt(4, '[access_scopes]', 'scopes = "read_customers,write_script_tags"')
      const scriptTags = finding({
        location: {file: 'shopify.app.toml', line: 5},
        message: 'write_script_tags is deprecated.',
        code_excerpt: scopes,
      })
      const customers = finding({
        location: {file: 'shopify.app.toml', line: 5},
        message: 'read_customers is not used.',
        code_excerpt: scopes,
      })

      const {checks, suppressions} = combineWith([entry({path: 'shopify.app.toml', code: 'write_script_tags'})], {
        deterministic: [check({findings: [scriptTags, customers]})],
      })

      expect(dispositions(checks)).toEqual([
        {message: 'read_customers is not used.', disposition: 'active'},
        {message: 'write_script_tags is deprecated.', disposition: 'suppressed'},
      ])
      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test('an entry whose code matches several findings alike is ambiguous and suppresses none', () => {
      const header = (line: number) =>
        finding({
          location: {file: path, line},
          message: 'The access token is sent to another host.',
          code_excerpt: excerpt(line, "  headers: {'X-Shopify-Access-Token': session.accessToken},"),
        })

      const {checks, suppressions} = combineWith(
        [entry({code: 'X-Shopify-Access-Token'}), entry({code: 'another host'})],
        {
          deterministic: [check({findings: [header(8), header(20)]})],
        },
      )

      expect(dispositions(checks).map(({disposition}) => disposition)).toEqual(['active', 'active'])
      expect(statuses(suppressions)).toEqual([
        {status: 'ambiguous', count: 0},
        // Text only in the messages matches neither finding, because both have captured code.
        {status: 'stale', count: 0},
      ])
      expect(suppressions.map((result) => result.candidate_locations)).toEqual([
        [
          {file: path, line: 8},
          {file: path, line: 20},
        ],
        undefined,
      ])
    })

    test("an ambiguous entry's candidates are the findings that rule 4 kept, when it kept several", () => {
      const scopes = excerpt(4, '[access_scopes]', 'scopes = "read_customers,write_script_tags"')
      const findings = [
        finding({
          location: {file: 'shopify.app.toml', line: 5},
          message: 'read_customers is not used.',
          code_excerpt: scopes,
        }),
        finding({
          location: {file: 'shopify.app.toml', line: 5},
          message: 'write_script_tags is deprecated.',
          code_excerpt: scopes,
        }),
        finding({
          location: {file: 'shopify.app.toml', line: 12},
          message: 'write_script_tags is requested again.',
          code_excerpt: excerpt(12, 'optional_scopes = "write_script_tags"'),
        }),
      ]

      const {suppressions} = combineWith([entry({path: 'shopify.app.toml', code: 'write_script_tags'})], {
        deterministic: [check({findings})],
      })

      expect(suppressions[0]).toMatchObject({status: 'ambiguous', matched_finding_count: 0})
      expect(suppressions[0]!.candidate_locations).toEqual([
        {file: 'shopify.app.toml', line: 5},
        {file: 'shopify.app.toml', line: 12},
      ])
    })

    test('a stale entry whose file is gone names the path of the one finding elsewhere that holds its code, and matches nothing', () => {
      const renamed = finding({...loggedToken, location: {file: 'app/routes/orders.server.tsx', line: 12}})
      const elsewhere = finding({...loggedOrder, location: {file: 'app/routes/other.tsx', line: 30}})
      const suppression = entry({code: 'console.log(session.accessToken)'})

      const {checks, suppressions} = combineWith([suppression], {
        deterministic: [check({findings: [renamed, elsewhere]})],
        missingPaths: [path],
      })

      expect(dispositions(checks).map(({disposition}) => disposition)).toEqual(['active', 'active'])
      expect(suppressions).toEqual([
        {
          index: 0,
          entry: suppression,
          status: 'stale',
          matched_finding_count: 0,
          likely_path: 'app/routes/orders.server.tsx',
        },
      ])
    })

    test('names no likely path while the file exists, for an entry without code, or when several findings hold the code', () => {
      const renamed = finding({...loggedToken, location: {file: 'app/routes/orders.server.tsx', line: 12}})
      const copied = finding({...loggedToken, location: {file: 'app/routes/admin.tsx', line: 12}})
      const withCode = entry({code: 'console.log(session.accessToken)'})
      const likelyPaths = (entries: SuppressionEntry[], findings: StoredFinding[], missingPaths: string[] = [path]) =>
        combineWith(entries, {deterministic: [check({findings})], missingPaths}).suppressions.map((result) => [
          result.status,
          result.likely_path,
        ])

      expect(likelyPaths([withCode], [renamed], [])).toEqual([['stale', undefined]])
      expect(likelyPaths([entry()], [renamed])).toEqual([['stale', undefined]])
      expect(likelyPaths([withCode], [renamed, copied])).toEqual([['stale', undefined]])
      expect(likelyPaths([withCode], [renamed, {...renamed}])).toEqual([['stale', undefined]])
      // Another entry's missing file doesn't count.
      expect(likelyPaths([withCode], [renamed], ['app/routes/deleted.tsx'])).toEqual([['stale', undefined]])
      // Text only in the message of a finding with captured code doesn't match that finding, so it names no path.
      expect(likelyPaths([entry({code: 'flows into console.log'})], [renamed])).toEqual([['stale', undefined]])
    })

    test('an entry that matches nothing in an executed result is stale', () => {
      const {checks, suppressions} = combineWith(
        [
          entry({code: 'console.log(session.idToken)'}),
          entry({path: 'app/routes/removed.tsx'}),
          // Only characters that the matching ignores: it names no code.
          entry({code: ' ,; '}),
        ],
        {deterministic: [check({findings: [loggedToken]})]},
      )

      expect(dispositions(checks)).toEqual([{message: loggedToken.message, disposition: 'active'}])
      expect(statuses(suppressions)).toEqual([
        {status: 'stale', count: 0},
        {status: 'stale', count: 0},
        {status: 'stale', count: 0},
      ])
    })

    test('an entry is not evaluated when its source recorded no result for the check', () => {
      const entries = [entry({source: 'agent'}), entry({check: 'NOT_RUN'})]

      const withoutAgent = combineWith(entries, {deterministic: [check({findings: [loggedToken]})]})
      const withOtherAgentCheck = combineWith(entries, {
        deterministic: [check({findings: [loggedToken]})],
        agent: [check({id: 'OTHER', findings: [loggedToken]})],
      })

      for (const {suppressions} of [withoutAgent, withOtherAgentCheck]) {
        expect(statuses(suppressions)).toEqual([
          {status: 'not-evaluated', count: 0},
          {status: 'not-evaluated', count: 0},
        ])
        expect(suppressions.map((result) => result.not_evaluated_reason)).toEqual([
          'no-executed-result',
          'no-executed-result',
        ])
      }
    })

    test.each<StoredCheckStatus>(['unresolved', 'not_applicable'])(
      "an entry that matches nothing is not evaluated when its source's result is %s",
      (status) => {
        const {suppressions} = combineWith([entry({source: 'agent'})], {agent: [check({status})]})

        expect(statuses(suppressions)).toEqual([{status: 'not-evaluated', count: 0}])
        expect(suppressions[0]!.not_evaluated_reason).toBe('no-executed-result')
      },
    )

    test('prefer-agent: a deterministic entry matches the superseded finding, and suppresses it without a current agent result', () => {
      const suppression = entry({code: 'console.log(session.accessToken)'})
      const deterministic = [check({findings: [loggedToken]})]
      const agent = [check({precedence: 'prefer-agent', findings: [finding({message: 'Agent finding.'})]})]

      const review = combineWith([suppression], {deterministic, agent})
      // `check` combines its deterministic results alone.
      const scan = combineWith([suppression], {deterministic})

      const [superseded] = review.checks[0]!.findings.filter((item) => item.source === 'deterministic')
      expect(superseded).toMatchObject({disposition: 'superseded', suppressed_by: {origin: 'file', entry_index: 0}})
      expect(statuses(review.suppressions)).toEqual([{status: 'matched', count: 1}])
      expect(dispositions(scan.checks)).toEqual([{message: loggedToken.message, disposition: 'suppressed'}])
      expect(statuses(scan.suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    test("the agent's per-run suppression is the rule's second origin, and an entry comes before it", () => {
      const agentSuppressed = finding({...loggedToken, suppression: {justification: 'Only logged in development.'}})
      const agent = [check({precedence: 'union', findings: [agentSuppressed]})]

      const [byAgent] = combineWith([], {agent}).checks[0]!.findings
      const [byEntry] = combineWith([entry({source: 'agent'})], {agent}).checks[0]!.findings

      expect(byAgent).toMatchObject({
        disposition: 'suppressed',
        suppressed_by: {origin: 'agent', reason: 'Only logged in development.'},
      })
      expect(byEntry).toMatchObject({disposition: 'suppressed', suppressed_by: {origin: 'file', entry_index: 0}})
    })

    test('a hand-edited suppression on a deterministic finding is ignored, but an entry suppresses the finding', () => {
      const handEdited = finding({...loggedToken, suppression: {justification: 'Hand-edited.'}})
      const deterministic = [check({findings: [handEdited]})]

      expect(combineWith([], {deterministic}).checks[0]!.findings[0]).not.toHaveProperty('suppressed_by')
      expect(dispositions(combineWith([], {deterministic}).checks)[0]!.disposition).toBe('active')
      expect(dispositions(combineWith([entry()], {deterministic}).checks)[0]!.disposition).toBe('suppressed')
    })

    test('reports every entry in file order, and names the first entry that matched a finding', () => {
      const entries = [entry({check: 'OTHER'}), entry({code: 'console.log(session.accessToken)'}), entry()]

      const {checks, suppressions} = combineWith(entries, {deterministic: [check({findings: [loggedToken]})]})

      expect(suppressions.map(({index, entry: suppression}) => ({index, suppression}))).toEqual(
        entries.map((suppression, index) => ({index, suppression})),
      )
      expect(statuses(suppressions)).toEqual([
        {status: 'not-evaluated', count: 0},
        {status: 'matched', count: 1},
        {status: 'matched', count: 1},
      ])
      expect(checks[0]!.findings[0]!.suppressed_by).toMatchObject({origin: 'file', entry_index: 1})
    })

    test('matches a finding whose recorded path is not normalized', () => {
      const unnormalized = finding({...loggedToken, location: {file: `./${path}`, line: 12}})

      const {suppressions} = combineWith([entry({source: 'agent'})], {agent: [check({findings: [unnormalized]})]})

      expect(statuses(suppressions)).toEqual([{status: 'matched', count: 1}])
    })

    // For the likely finding: a finding's flagged line, in its excerpt.
    const flaggedAt = (line: number, text: string, overrides: Partial<StoredFinding> = {}) =>
      finding({
        location: {file: path, line},
        message: 'Flagged.',
        evidence: [],
        code_excerpt: excerpt(line, text),
        ...overrides,
      })
    // An HTML sink: code without a secret, as the UNSAFE_INNERHTML rule flags it.
    const sinkCode = (name: string) => `dangerouslySetInnerHTML={{__html: ${name}.descriptionHtml}}`
    const sinkAt = (line: number, name: string, overrides: Partial<StoredFinding> = {}) =>
      flaggedAt(line, `  <div ${sinkCode(name)} />`, overrides)
    const productEntry = entry({check: 'UNSAFE_INNERHTML', code: sinkCode('product')})
    // A committed token, as `check` captures the line, redacted. The token is never in the results.
    const secretLine = (name: string) => `export const ${name} = "shpa[REDACTED:38]"`
    const likelyFindings = (
      entries: SuppressionEntry[],
      findings: StoredFinding[],
      {id = 'UNSAFE_INNERHTML', missingPaths = []}: {id?: string; missingPaths?: string[]} = {},
    ) =>
      combineWith(entries, {deterministic: [check({id, findings})], missingPaths}).suppressions.map((result) => [
        result.status,
        result.likely_finding,
      ])

    test('likely finding: is the finding whose flagged line renames an identifier of the code, and the entry still matches nothing', () => {
      const renamed = sinkAt(4, 'item')

      const {checks, suppressions} = combineWith([productEntry], {
        deterministic: [
          check({id: 'UNSAFE_INNERHTML', findings: [flaggedAt(9, '  element.innerHTML = banner'), renamed]}),
        ],
      })

      expect(dispositions(checks).map(({disposition}) => disposition)).toEqual(['active', 'active'])
      expect(suppressions).toEqual([
        {
          index: 0,
          entry: productEntry,
          status: 'stale',
          matched_finding_count: 0,
          likely_finding: {index: 1, file: path, line: 4},
        },
      ])
    })

    test('likely finding: compares words, so a reformat and other quotes around the renamed line keep it similar', () => {
      const reformatted = flaggedAt(4, '<div dangerouslySetInnerHTML={ { __html: item.descriptionHtml } }/>')
      const quotedEntry = entry({code: "console.log('order', order)"})
      const requoted = flaggedAt(30, '  console.log("order", shop);')

      expect(likelyFindings([productEntry], [reformatted])).toEqual([['stale', {index: 0, file: path, line: 4}]])
      expect(likelyFindings([quotedEntry], [requoted], {id: 'CHECK'})).toEqual([
        ['stale', {index: 0, file: path, line: 30}],
      ])
    })

    test('likely finding: is no finding whose flagged line shares fewer than two thirds of the words of the code', () => {
      // 2 of the 4 words of the code: dangerouslySetInnerHTML and __html.
      const unrelated = flaggedAt(7, '  <p dangerouslySetInnerHTML={{__html: shop.policyBody}} />')
      // 2 of the 3 words of `console.log(order)`, as a rename of one of 3 words keeps.
      const loggedOrderEntry = entry({code: 'console.log(order)'})
      const loggedShop = finding({...loggedOrder, code_excerpt: excerpt(30, 'console.log(shop)')})

      expect(likelyFindings([productEntry], [unrelated])).toEqual([['stale', undefined]])
      expect(
        combineWith([loggedOrderEntry], {deterministic: [check({findings: [loggedShop]})]}).suppressions[0]!
          .likely_finding,
      ).toEqual({index: 0, file: path, line: 30})
    })

    test('likely finding: is no finding when two findings are similar to the code, or when two stale entries are similar to one finding', () => {
      const renamed = sinkAt(4, 'item')
      const copied = sinkAt(8, 'variant')
      const otherEntry = entry({check: 'UNSAFE_INNERHTML', code: sinkCode('collection')})

      expect(likelyFindings([productEntry], [renamed, copied])).toEqual([['stale', undefined]])
      expect(likelyFindings([productEntry, otherEntry], [renamed])).toEqual([
        ['stale', undefined],
        ['stale', undefined],
      ])
    })

    test('likely finding: is no finding that an entry or the agent already suppresses', () => {
      const renamed = sinkAt(4, 'item')
      const suppressingEntry = entry({check: 'UNSAFE_INNERHTML', code: sinkCode('item')})
      const agentSuppressed = finding({
        ...loggedToken,
        code_excerpt: excerpt(12, '  console.log(currentSession.accessToken)'),
        suppression: {justification: 'Only logged in development.'},
      })
      const agentEntry = entry({source: 'agent', code: 'console.log(session.accessToken)'})

      expect(likelyFindings([productEntry, suppressingEntry], [renamed])).toEqual([
        ['stale', undefined],
        ['matched', undefined],
      ])
      expect(
        combineWith([agentEntry], {agent: [check({findings: [agentSuppressed]})]}).suppressions[0]!.likely_finding,
      ).toBeUndefined()
    })

    test('likely finding: is none for an entry without code, or whose file is gone, which keeps its likely path', () => {
      const renamed = sinkAt(4, 'item')
      const elsewhere = sinkAt(4, 'product', {location: {file: 'app/routes/product.tsx', line: 4}})
      const withoutCode = entry({check: 'UNSAFE_INNERHTML', path: 'app/routes/removed.ts'})

      expect(likelyFindings([withoutCode], [renamed])).toEqual([['stale', undefined]])
      const [gone] = combineWith([productEntry], {
        deterministic: [check({id: 'UNSAFE_INNERHTML', findings: [renamed, elsewhere]})],
        missingPaths: [path],
      }).suppressions
      expect(gone).toMatchObject({status: 'stale', likely_path: 'app/routes/product.tsx'})
      expect(gone).not.toHaveProperty('likely_finding')
    })

    test("likely finding: is a finding of the entry's own source and check only, without a line, and for agent entries too", () => {
      const renamed = sinkAt(4, 'item')
      const withoutLine = sinkAt(4, 'item', {location: {file: path}})
      const agentEntry = entry({source: 'agent', code: 'console.log(session.accessToken)'})
      const agentRenamed = finding({
        ...loggedToken,
        code_excerpt: excerpt(12, '  console.log(currentSession.accessToken)'),
      })

      // The deterministic finding is of another check.
      expect(likelyFindings([entry({check: 'OTHER', code: sinkCode('product')})], [renamed])).toEqual([
        ['not-evaluated', undefined],
      ])
      expect(likelyFindings([productEntry], [withoutLine])).toEqual([['stale', undefined]])
      const agent = combineWith([agentEntry], {
        deterministic: [check({findings: [agentRenamed]})],
        agent: [check({findings: [agentRenamed]})],
      })
      expect(agent.suppressions[0]).toMatchObject({status: 'stale', likely_finding: {index: 0, line: 12}})
    })

    test('likely finding: is none for a rename on a line with a redacted secret, which hides the only text that tells two credentials apart', () => {
      const keyEntry = entry({check: 'COMMITTED_SECRET', code: secretLine('KEY')})
      // The entry of a token field, after its line was deleted and another session object with its own token was added.
      const adminEntry = entry({check: 'COMMITTED_SECRET', code: 'adminAccessToken: "shpa[REDACTED:38]",'})
      const otherCredential = flaggedAt(8, '  accessToken: "shpa[REDACTED:38]",')

      expect(likelyFindings([keyEntry], [flaggedAt(4, secretLine('KEY2'))], {id: 'COMMITTED_SECRET'})).toEqual([
        ['stale', undefined],
      ])
      expect(likelyFindings([adminEntry], [otherCredential], {id: 'COMMITTED_SECRET'})).toEqual([['stale', undefined]])
    })

    test('likely finding: is none when only the flagged line, or only the code, holds a redacted secret', () => {
      const loggedEntry = entry({source: 'agent', code: 'console.log(session.accessToken)'})
      const agentLine = (text: string) =>
        combineWith([loggedEntry], {agent: [check({findings: [flaggedAt(12, text)]})]})
      // The code's words without a redaction marker, so only the code's marker tells the two apart.
      const redactedCodeEntry = entry({code: 'console.log("shpa[REDACTED:38]", session.accessToken)'})

      expect(agentLine('  console.log(session.accessToken, "shpa[REDACTED:38]")').suppressions[0]).toMatchObject({
        status: 'stale',
      })
      expect(agentLine('  console.log(session.accessToken, "shpa[REDACTED:38]")').suppressions[0]).not.toHaveProperty(
        'likely_finding',
      )
      expect(agentLine('  console.log(session.accessToken) // [REDACTED TEXT]').suppressions[0]).not.toHaveProperty(
        'likely_finding',
      )
      expect(agentLine('  console.log(currentSession.accessToken)').suppressions[0]).toMatchObject({
        likely_finding: {index: 0, line: 12},
      })
      expect(
        likelyFindings([redactedCodeEntry], [flaggedAt(12, 'console.log("shpa REDACTED 38", session.accessToken)')], {
          id: 'CHECK',
        }),
      ).toEqual([['stale', undefined]])
    })

    test('likely finding: a similar line with a redacted secret still makes the other similar line ambiguous', () => {
      const loggedEntry = entry({code: 'console.log(session.accessToken)'})
      const renamed = flaggedAt(12, '  console.log(currentSession.accessToken)')
      const withToken = flaggedAt(14, '  console.log(session.accessToken, "shpa[REDACTED:38]")')

      expect(likelyFindings([loggedEntry], [renamed], {id: 'CHECK'})).toEqual([
        ['stale', {index: 0, file: path, line: 12}],
      ])
      expect(likelyFindings([loggedEntry], [renamed, withToken], {id: 'CHECK'})).toEqual([['stale', undefined]])
    })

    test('likely finding: prefer-agent: a superseded deterministic finding that nothing suppresses is the likely finding of a deterministic entry', () => {
      const renamed = finding({
        ...loggedToken,
        code_excerpt: excerpt(12, '  console.log(currentSession.accessToken)'),
      })
      const deterministic = [check({findings: [renamed]})]
      const agent = [check({precedence: 'prefer-agent', findings: [finding({message: 'Agent finding.'})]})]

      const {checks, suppressions} = combineWith([entry({code: 'console.log(session.accessToken)'})], {
        deterministic,
        agent,
      })

      expect(checks[0]!.findings.find(({source}) => source === 'deterministic')?.disposition).toBe('superseded')
      expect(suppressions[0]).toMatchObject({status: 'stale', likely_finding: {index: 0, line: 12}})
    })
  })

  describe('canonical ordering', () => {
    test('orders checks by severity then id, whichever source recorded them', () => {
      const {checks: combined} = combineFindings({
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
    const {checks: combined} = combineFindings({
      deterministic: deterministicFindingsDocument,
      agent: agentFindingsDocument,
    })

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
    const {checks} = combineFindings({
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
