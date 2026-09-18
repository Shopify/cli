import {CONFIGURATION_IDENTITY, PRODUCED_AT, scopeDescriptor} from './fixtures/result-contract.js'
import {loadChecks} from '../checks/index.js'
import {getAppDoctorResultOutcome, parseAppDoctorResult} from '../results/index.js'
import {encodeAppDoctorReviewBinding} from '../review/binding.js'
import {prepareAppDoctorRecord} from '../review/record.js'
import {sha256} from '../trace/index.js'
import {ENGINE_NAME} from '../types.js'
import {describe, expect, test} from 'vitest'
import type {Check} from '../checks/index.js'
import type {AppDoctorScopeDescriptor} from '../results/index.js'
import type {AppDoctorReviewBinding} from '../review/binding.js'
import type {AppDoctorAgentFindingInput, AppDoctorAgentFindingsDocument} from '../review/findings.js'
import type {AppDoctorRecordInput, AppDoctorRecordPreparation} from '../review/record.js'

const ENGINE = {name: ENGINE_NAME, version: '3.99.0'}
const FIRST_CHECK = 'REQUEST_DERIVED_SHOP_SCOPE'
const SECOND_CHECK = 'WEBHOOK_HMAC_UNVERIFIED'
const OTHER_SCOPE_IDENTITY = `sha256:${'c'.repeat(64)}`
const OTHER_CONFIGURATION_IDENTITY = 'd'.repeat(32)

function check(id: string, prompt = `Review the app for ${id}.`, version = 2): Check {
  return {id, version, tier: 'agentic', severity: 'high', prompt, prompt_hash: sha256(prompt)}
}

function catalogue(): Map<string, Check> {
  return new Map([FIRST_CHECK, SECOND_CHECK].map((id) => [id, check(id)]))
}

/** A descriptor for the `web` subdirectory of the same app, so two scopes can share one configuration. */
function webScopeDescriptor(): AppDoctorScopeDescriptor {
  return {...scopeDescriptor(), directory: {base: 'storage_anchor', up: 0, path: 'web'}}
}

function binding(overrides: Partial<AppDoctorReviewBinding> = {}, checks = catalogue()): AppDoctorReviewBinding {
  return {
    version: 1,
    configuration_identity: CONFIGURATION_IDENTITY,
    scope_identity: `sha256:${'a'.repeat(64)}`,
    scope: scopeDescriptor(),
    checks: [...checks.values()]
      .sort((left, right) => (left.id < right.id ? -1 : 1))
      .map((item) => ({id: item.id, version: item.version, prompt_hash: item.prompt_hash})),
    engine: ENGINE,
    ...overrides,
  }
}

function finding(overrides: Partial<AppDoctorAgentFindingInput> = {}): AppDoctorAgentFindingInput {
  return {
    title: 'Shop scope taken from the request',
    message: 'The orders loader filters by the `shop` query parameter.',
    severity: 'medium',
    location: {file: 'app/routes/orders.tsx', line: 42, column: 7},
    evidence: [{location: {file: 'app/routes/orders.tsx', line: 42}, quote: 'url.searchParams.get("shop")'}],
    snippet: 'const shop = url.searchParams.get("shop")',
    fix: {description: 'Read the shop from the authenticated session.', guide: 'https://shopify.dev'},
    agent_confidence: 'high',
    agent_reasoning: 'The parameter flows into the tenant filter unchecked.',
    ...overrides,
  }
}

function document(token: string, checks?: AppDoctorAgentFindingsDocument['checks']): AppDoctorAgentFindingsDocument {
  return {
    schema_version: 1,
    review: token,
    checks: checks ?? [
      {check_id: FIRST_CHECK, outcome: 'findings', inspected_files: ['app/routes/orders.tsx'], findings: [finding()]},
      {check_id: SECOND_CHECK, outcome: 'clean', inspected_files: ['app/routes/webhooks.tsx'], findings: []},
    ],
  }
}

function input(
  submissions: AppDoctorRecordInput['submissions'],
  overrides: Partial<AppDoctorRecordInput> = {},
): AppDoctorRecordInput {
  return {
    configurationIdentity: CONFIGURATION_IDENTITY,
    submissions,
    checks: catalogue(),
    engine: ENGINE,
    producedAt: PRODUCED_AT,
    ...overrides,
  }
}

function submission(token: string, doc: unknown = document(token), documentLabel = '/tmp/findings.json') {
  return {token, document: doc, documentLabel}
}

function expectRejected(preparation: AppDoctorRecordPreparation) {
  if (preparation.status !== 'rejected') throw new Error(`expected rejection, got ${preparation.status}`)
  return preparation.problems
}

function expectReady(preparation: AppDoctorRecordPreparation) {
  if (preparation.status !== 'ready') throw new Error(`expected ready, got ${JSON.stringify(preparation.problems)}`)
  return preparation
}

describe('prepareAppDoctorRecord', () => {
  test('builds one agent result per bound check across submissions, in submission order', () => {
    const firstToken = encodeAppDoctorReviewBinding(binding())
    const secondToken = encodeAppDoctorReviewBinding(
      binding({scope_identity: OTHER_SCOPE_IDENTITY, scope: webScopeDescriptor()}),
    )
    const secondDocument = document(secondToken, [
      {check_id: FIRST_CHECK, outcome: 'not_applicable', inspected_files: [], findings: []},
      {
        check_id: SECOND_CHECK,
        outcome: 'unresolved',
        inspected_files: ['package.json'],
        reason: 'The lockfile is absent.',
        guidance: 'Commit a lockfile.',
        findings: [],
      },
    ])

    const preparation = expectReady(
      prepareAppDoctorRecord(input([submission(firstToken), submission(secondToken, secondDocument)])),
    )

    expect(preparation.entries).toHaveLength(4)
    expect(preparation.entries.map((entry) => getAppDoctorResultOutcome(entry))).toEqual([
      'findings',
      'clean',
      'not_applicable',
      'unresolved',
    ])
    for (const entry of preparation.entries) {
      expect(parseAppDoctorResult(JSON.parse(JSON.stringify(entry)))).toEqual({ok: true, result: entry})
      expect(entry.mode).toBe('agent')
      expect(entry.configuration_identity).toBe(CONFIGURATION_IDENTITY)
      expect(entry.produced_at).toBe(PRODUCED_AT)
      expect(entry.engine).toEqual({name: ENGINE_NAME, version: '3.99.0', ruleset: 'app-doctor-rules@3.99.0'})
    }
    expect(preparation.scopes).toEqual([
      {
        scope_identity: `sha256:${'a'.repeat(64)}`,
        descriptor: scopeDescriptor(),
        check_ids: [FIRST_CHECK, SECOND_CHECK],
      },
      {scope_identity: OTHER_SCOPE_IDENTITY, descriptor: webScopeDescriptor(), check_ids: [FIRST_CHECK, SECOND_CHECK]},
    ])
    const unresolved = preparation.entries[3]!
    expect(unresolved.execution).toMatchObject({
      status: 'unresolved',
      reason: {code: 'agent_investigation_required', message: 'The lockfile is absent.'},
      guidance: 'Commit a lockfile.',
      inspected_files: ['anchor/0/web/package.json'],
    })
    expect(preparation.entries[2]!.execution).toMatchObject({status: 'not_applicable', inspected_files: []})
  })

  test('maps agent findings onto the result contract with a diagnostic key and derived identity', () => {
    const token = encodeAppDoctorReviewBinding(binding())

    const preparation = expectReady(prepareAppDoctorRecord(input([submission(token)])))

    const result = preparation.entries[0]!
    expect(result.check_id).toBe(FIRST_CHECK)
    expect(result.check_version).toBe(2)
    expect(result.mode === 'agent' && result.prompt).toBe(`Review the app for ${FIRST_CHECK}.`)
    expect(result.mode === 'agent' && result.prompt_hash).toBe(sha256(`Review the app for ${FIRST_CHECK}.`))
    expect(result.execution.inspected_files).toEqual(['anchor/0/app/routes/orders.tsx'])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      code: FIRST_CHECK,
      severity: 'medium',
      points: -10,
      confidence: 'agentic',
      title: 'Shop scope taken from the request',
      location: {file: 'anchor/0/app/routes/orders.tsx', line: 42, column: 7},
      evidence: [{location: {file: 'anchor/0/app/routes/orders.tsx', line: 42}, quote: 'url.searchParams.get("shop")'}],
      fix: {
        automated: false,
        description: 'Read the shop from the authenticated session.',
        guide: 'https://shopify.dev',
      },
      agent_confidence: 'high',
      agent_reasoning: 'The parameter flows into the tenant filter unchecked.',
      key: {namespace: 'diagnostic-v1'},
    })
    expect(result.findings[0]!.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test('derives points from the agent-reported severity', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const doc = document(token, [
      {
        check_id: FIRST_CHECK,
        outcome: 'findings',
        inspected_files: ['a.ts'],
        findings: [finding({severity: 'high'}), finding({severity: 'low', title: 'Another'})],
      },
      {check_id: SECOND_CHECK, outcome: 'clean', inspected_files: ['b.ts'], findings: []},
    ])

    const preparation = expectReady(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(preparation.entries[0]!.findings.map((item) => item.points)).toEqual([-15, -5])
  })

  test('is deterministic: identical input yields identical entries and fingerprints', () => {
    const token = encodeAppDoctorReviewBinding(binding())

    const first = expectReady(prepareAppDoctorRecord(input([submission(token)])))
    const second = expectReady(prepareAppDoctorRecord(input([submission(token)])))

    expect(second.entries).toEqual(first.entries)
    expect(second.entries[0]!.findings[0]!.fingerprint).toBe(first.entries[0]!.findings[0]!.fingerprint)
  })

  test('works against the embedded check catalogue', () => {
    const checks = loadChecks()
    const token = encodeAppDoctorReviewBinding(binding({}, checks))
    const doc = document(
      token,
      [...checks.keys()].map((id) => ({
        check_id: id,
        outcome: 'not_applicable' as const,
        inspected_files: [],
        findings: [],
      })),
    )

    const preparation = expectReady(prepareAppDoctorRecord(input([submission(token, doc)], {checks})))

    expect(preparation.entries).toHaveLength(checks.size)
    expect(new Set(preparation.entries.map((entry) => getAppDoctorResultOutcome(entry)))).toEqual(
      new Set(['not_applicable']),
    )
  })

  test('rejects an undecodable token without echoing it', () => {
    const problems = expectRejected(prepareAppDoctorRecord(input([submission('adr1.not-a-token!!')])))

    expect(problems).toEqual([{code: 'invalid_token', message: expect.stringContaining('review token'), submission: 0}])
    expect(problems[0]!.message).not.toContain('not-a-token')
  })

  test('rejects a token generated for another configuration', () => {
    const token = encodeAppDoctorReviewBinding(binding({configuration_identity: OTHER_CONFIGURATION_IDENTITY}))

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token)])))

    expect(problems).toEqual([
      {
        code: 'foreign_configuration',
        message: expect.stringContaining('shopify app doctor instructions'),
        submission: 0,
      },
    ])
  })

  test('rejects an invalid document with a path-qualified message', () => {
    const token = encodeAppDoctorReviewBinding(binding())

    const problems = expectRejected(
      prepareAppDoctorRecord(input([submission(token, {schema_version: 2}, '/reviews/web.json')])),
    )

    expect(problems).toEqual([
      {code: 'invalid_document', message: expect.stringContaining('/reviews/web.json'), submission: 0},
    ])
    expect(problems[0]!.message).toContain('schema_version')
  })

  test('rejects a document whose review token differs from the --review token', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const otherToken = encodeAppDoctorReviewBinding(binding({scope_identity: OTHER_SCOPE_IDENTITY}))

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, document(otherToken))])))

    expect(problems).toEqual([{code: 'document_token_mismatch', message: expect.any(String), submission: 0}])
  })

  test('reports every check the document omits or adds', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const doc = document(token, [
      {check_id: FIRST_CHECK, outcome: 'clean', inspected_files: ['a.ts'], findings: []},
      {check_id: 'MADE_UP_CHECK', outcome: 'clean', inspected_files: ['a.ts'], findings: []},
    ])

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(problems).toEqual([
      {code: 'missing_check', message: expect.stringContaining(SECOND_CHECK), submission: 0, check_id: SECOND_CHECK},
      {
        code: 'unknown_check',
        message: expect.stringContaining('MADE_UP_CHECK'),
        submission: 0,
        check_id: 'MADE_UP_CHECK',
      },
    ])
  })

  test('rejects a token whose check prompt hash or version no longer matches this catalogue', () => {
    const staleChecks = catalogue()
    staleChecks.set(FIRST_CHECK, check(FIRST_CHECK, 'An older prompt.'))
    staleChecks.set(SECOND_CHECK, check(SECOND_CHECK, `Review the app for ${SECOND_CHECK}.`, 1))
    const token = encodeAppDoctorReviewBinding(binding({}, staleChecks))

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token)])))

    expect(problems).toEqual([
      {code: 'stale_check', message: expect.stringContaining('Regenerate'), submission: 0, check_id: FIRST_CHECK},
      {code: 'stale_check', message: expect.stringContaining('Regenerate'), submission: 0, check_id: SECOND_CHECK},
    ])
  })

  test('rejects a check the token names that this CLI does not ship', () => {
    const extended = catalogue()
    extended.set('RETIRED_CHECK', check('RETIRED_CHECK'))
    const token = encodeAppDoctorReviewBinding(binding({}, extended))
    const doc = document(token, [
      ...document(token).checks,
      {check_id: 'RETIRED_CHECK', outcome: 'clean', inspected_files: ['a.ts'], findings: []},
    ])

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(problems).toEqual([
      {code: 'stale_check', message: expect.any(String), submission: 0, check_id: 'RETIRED_CHECK'},
    ])
  })

  test('rejects two submissions for the same scope', () => {
    const token = encodeAppDoctorReviewBinding(binding())

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token), submission(token)])))

    expect(problems).toEqual([{code: 'duplicate_scope', message: expect.any(String), submission: 1}])
  })

  test('collects problems from every submission instead of stopping at the first', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const foreign = encodeAppDoctorReviewBinding(
      binding({configuration_identity: OTHER_CONFIGURATION_IDENTITY, scope_identity: OTHER_SCOPE_IDENTITY}),
    )

    const problems = expectRejected(
      prepareAppDoctorRecord(input([submission('garbage'), submission(foreign), submission(token)])),
    )

    expect(problems.map((problem) => [problem.code, problem.submission])).toEqual([
      ['invalid_token', 0],
      ['foreign_configuration', 1],
    ])
  })

  test('stamps every entry with the supplied produced_at, so re-recording is a fresh review', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const first = expectReady(prepareAppDoctorRecord(input([submission(token)]))).entries
    const later = expectReady(
      prepareAppDoctorRecord(input([submission(token)], {producedAt: '2026-09-17T08:00:00.000Z'})),
    ).entries

    expect(new Set(first.map((entry) => entry.produced_at))).toEqual(new Set([PRODUCED_AT]))
    expect(new Set(later.map((entry) => entry.produced_at))).toEqual(new Set(['2026-09-17T08:00:00.000Z']))
    expect(later.map((entry) => entry.findings)).toEqual(first.map((entry) => entry.findings))
  })

  test('surfaces a result-contract rejection as an invalid document naming the check', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const doc = document(token, [
      // Executed agent checks must inspect at least one file; the document schema alone allows this.
      {check_id: FIRST_CHECK, outcome: 'clean', inspected_files: [], findings: []},
      {check_id: SECOND_CHECK, outcome: 'clean', inspected_files: ['b.ts'], findings: []},
    ])

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(problems).toEqual([
      {code: 'invalid_document', message: expect.stringContaining(FIRST_CHECK), submission: 0, check_id: FIRST_CHECK},
    ])
  })

  test('surfaces a duplicate finding as an invalid document with the finding index', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const doc = document(token, [
      {check_id: FIRST_CHECK, outcome: 'findings', inspected_files: ['a.ts'], findings: [finding(), finding()]},
      {check_id: SECOND_CHECK, outcome: 'clean', inspected_files: ['b.ts'], findings: []},
    ])

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(problems).toEqual([
      {
        code: 'invalid_document',
        message: expect.stringContaining('findings[1]'),
        submission: 0,
        check_id: FIRST_CHECK,
      },
    ])
  })

  test('surfaces a finding path the evidence contract cannot carry with the finding index', () => {
    const token = encodeAppDoctorReviewBinding(binding())
    const doc = document(token, [
      {
        check_id: FIRST_CHECK,
        outcome: 'findings',
        inspected_files: ['a.ts'],
        // Passes the document schema, but the evidence contract refuses secret-like path components.
        findings: [finding(), finding({title: 'Second', location: {file: `app/shpat_${'a'.repeat(16)}.ts`}})],
      },
      {check_id: SECOND_CHECK, outcome: 'clean', inspected_files: ['b.ts'], findings: []},
    ])

    const problems = expectRejected(prepareAppDoctorRecord(input([submission(token, doc)])))

    expect(problems).toEqual([
      {code: 'invalid_document', message: expect.stringContaining('findings[1]'), submission: 0, check_id: FIRST_CHECK},
    ])
  })
})
