import {agentFindingsDocument, deterministicFindingsDocument} from './fixtures/findings-documents.js'
import {buildSubmission, SUBMISSION_SCHEMA_VERSION} from '../submission/index.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {AppSecuritySubmission, BuildSubmissionOptions} from '../submission/index.js'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from '../types.js'

const fixturesDirectory = joinPath(moduleDirectory(import.meta.url), 'fixtures')

async function jsonFixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(joinPath(fixturesDirectory, name))) as T
}

const options: BuildSubmissionOptions = {
  cliVersion: '3.99.0',
  submittedAt: '2026-09-01T09:30:00.000Z',
  versionTag: 'v1.2.3',
  feedback: 'The result for /Users/example/app included AKIA1234567890ABCDEF inaccurately.',
}

function sources(): {deterministic: DeterministicFindingsDocument; agent: AgentFindingsDocument} {
  return {deterministic: structuredClone(deterministicFindingsDocument), agent: structuredClone(agentFindingsDocument)}
}

/** The shared fixtures with `secret` planted in every free-text field the payload copies from a document. */
function sourcesWithSecretInFreeText(secret: string): ReturnType<typeof sources> {
  const input = sources()
  for (const document of [input.deterministic, input.agent]) {
    // `engine.name` is typed as the literal ENGINE_NAME; widening it lets the test plant the secret there too.
    const engine: {name: string; version: string} = document.engine
    engine.name = `engine-${secret}`
    engine.version = `version-${secret}`
    document.checks[0]!.snapshot.title = `${document.checks[0]!.snapshot.title}: ${secret}`
  }
  input.deterministic.engine.ruleset = `ruleset-${secret}`
  return input
}

/**
 * Documents with a unique sentinel in every field §10.2 excludes from the payload. Each sentinel is listed in
 * submission-forbidden-values.json, so the test proves every exclusion for both sources.
 */
function leakyDeterministicDocument(): DeterministicFindingsDocument {
  return {
    schema_version: 1,
    source: 'deterministic',
    engine: {name: 'shopify-app-security', version: '3.99.0', ruleset: 'app-security-rules@3.99.0'},
    generated_at: '2026-09-01T10:00:00.000Z',
    project: {commit: 'LEAK_COMMIT_SHA_0123456789abcdef', dirty: false},
    detection: {
      framework: 'react_router',
      surface: 'react_router',
      languages: [{name: 'typescript', support: 'supported', files: ['leak/deterministic/languages.ts']}],
    },
    coverage: {
      files_scanned: 3,
      files_skipped: [
        {path: 'leak/skipped/too-large.js', reason: 'too_large', size_bytes: 2_500_000},
        {path: 'leak/skipped/unreadable.js', reason: 'unreadable', detail: 'LEAK_SKIPPED_DETAIL'},
      ],
      gaps: [
        {code: 'skipped_file', message: 'LEAK_GAP_MESSAGE', file: 'leak/gap/skipped-file.js'},
        {code: 'unresolved_check', message: 'LEAK_UNRESOLVED_GAP_MESSAGE', check_id: 'MISSING_TENANT_ISOLATION'},
      ],
    },
    checks: [
      {
        id: 'CREDENTIAL_LOG_LEAKAGE',
        version: 1,
        status: 'executed',
        analysis_mode: 'ast',
        snapshot: {
          title: 'Credential reaches a log sink',
          severity: 'high',
          description: 'LEAK_DETERMINISTIC_SNAPSHOT_DESCRIPTION',
          guide: 'LEAK_DETERMINISTIC_SNAPSHOT_GUIDE',
          current_version: 1,
        },
        findings: [
          {
            location: {file: 'leak/deterministic/location.ts', line: 12, column: 5},
            message: 'LEAK_DETERMINISTIC_MESSAGE',
            evidence: [
              {
                location: {file: 'leak/deterministic/evidence.ts', line: 12},
                quote: 'LEAK_DETERMINISTIC_EVIDENCE_QUOTE',
              },
            ],
            snippet: 'LEAK_DETERMINISTIC_SNIPPET',
            fix: {automated: false, description: 'LEAK_FIX_DESCRIPTION', guide: 'LEAK_FIX_GUIDE'},
          },
        ],
      },
      {
        id: 'MISSING_TENANT_ISOLATION',
        version: 4,
        status: 'unresolved',
        reason: {code: 'parser_unavailable', message: 'LEAK_DETERMINISTIC_REASON_MESSAGE'},
        analysis_mode: 'ast',
        snapshot: {
          title: 'Database query may not be scoped by shop',
          severity: 'high',
          description: 'LEAK_DETERMINISTIC_SNAPSHOT_DESCRIPTION',
          current_version: 4,
        },
        findings: [],
      },
    ],
  }
}

function leakyAgentDocument(): AgentFindingsDocument {
  return {
    schema_version: 1,
    source: 'agent',
    engine: {name: 'shopify-app-security', version: '3.99.0'},
    generated_at: '2026-09-01T11:30:00.000Z',
    project: {commit: 'LEAK_AGENT_COMMIT_SHA_fedcba9876543210', dirty: true},
    checks: [
      {
        id: 'MISSING_TENANT_ISOLATION',
        version: 4,
        status: 'executed',
        snapshot: {
          title: 'Database query may not be scoped by shop',
          severity: 'high',
          description: 'LEAK_AGENT_SNAPSHOT_DESCRIPTION',
          guide: 'LEAK_AGENT_SNAPSHOT_GUIDE',
          current_version: 4,
          precedence: 'union',
        },
        findings: [
          {
            location: {file: 'leak/agent/location.ts', line: 31},
            message: 'LEAK_AGENT_MESSAGE',
            evidence: [{location: {file: 'leak/agent/evidence.ts', line: 31}, quote: 'LEAK_AGENT_EVIDENCE_QUOTE'}],
            snippet: 'LEAK_AGENT_SNIPPET',
            confidence: 'high',
            reasoning: 'LEAK_AGENT_REASONING',
          },
          {
            location: {file: 'leak/agent/location.ts', line: 55},
            message: 'LEAK_AGENT_MESSAGE',
            evidence: [],
            confidence: 'medium',
            suppression: {justification: 'LEAK_SUPPRESSION_JUSTIFICATION'},
          },
        ],
      },
      {
        id: 'OPEN_REDIRECT',
        version: 2,
        status: 'not_applicable',
        reason: {code: 'LEAK_AGENT_REASON_CODE', message: 'LEAK_AGENT_REASON_MESSAGE'},
        snapshot: {
          title: 'Open redirect in auth callback',
          severity: 'medium',
          description: 'LEAK_AGENT_SNAPSHOT_DESCRIPTION',
          current_version: 2,
          precedence: 'union',
        },
        findings: [],
      },
      {
        id: 'UNAUTHENTICATED_ENDPOINT',
        version: 2,
        status: 'unresolved',
        reason: {code: 'LEAK_UNRESOLVED_REASON_CODE', message: 'LEAK_UNRESOLVED_REASON_MESSAGE'},
        snapshot: {
          title: 'Route handler lacks recognized auth verification',
          severity: 'high',
          description: 'LEAK_AGENT_SNAPSHOT_DESCRIPTION',
          current_version: 2,
          precedence: 'union',
        },
        findings: [],
      },
    ],
  }
}

describe('buildSubmission', () => {
  test('is at schema version 2', () => {
    expect(SUBMISSION_SCHEMA_VERSION).toBe(2)
  })

  // The golden files are hand-pinned from the shared documents and must never be generated by buildSubmission.
  test('matches the pinned golden payload when both sources are present', async () => {
    const expected = await jsonFixture<AppSecuritySubmission>('submission.json')

    expect(expected.schemaVersion).toBe(SUBMISSION_SCHEMA_VERSION)
    expect(buildSubmission(sources(), options)).toEqual(expected)
  })

  test('matches the pinned golden payload for a deterministic-only state', async () => {
    const expected = await jsonFixture<AppSecuritySubmission>('submission-deterministic-only.json')

    expect(
      buildSubmission(
        {deterministic: sources().deterministic, agent: null},
        {cliVersion: '3.99.0', submittedAt: '2026-09-01T09:30:00.000Z'},
      ),
    ).toEqual(expected)
  })

  test('matches the pinned golden payload for an agent-only state', async () => {
    const expected = await jsonFixture<AppSecuritySubmission>('submission-agent-only.json')

    expect(
      buildSubmission(
        {deterministic: null, agent: sources().agent},
        {cliVersion: '3.99.0', submittedAt: '2026-09-01T09:30:00.000Z', versionTag: 'v1.2.3'},
      ),
    ).toEqual(expected)
  })

  test('serializes the pinned key order so submission.json reads like the design', () => {
    const serialized = JSON.stringify(buildSubmission(sources(), options))

    expect(Object.keys(JSON.parse(serialized).report)).toEqual([
      'cli_version',
      'submitted_at',
      'feedback',
      'metadata',
      'sources',
    ])
    expect(Object.keys(JSON.parse(serialized).report.sources.deterministic)).toEqual([
      'schema_version',
      'source',
      'engine',
      'generated_at',
      'project',
      'checks',
      'detection',
      'coverage',
    ])
    expect(Object.keys(JSON.parse(serialized).report.sources.agent)).toEqual([
      'schema_version',
      'source',
      'engine',
      'generated_at',
      'project',
      'checks',
    ])
  })

  test('throws an internal error when neither source is present', () => {
    expect(() => buildSubmission({deterministic: null, agent: null}, options)).toThrow(
      'buildSubmission needs at least one findings document.',
    )
  })

  test('the agent filter drops reason entirely and the deterministic projection keeps only reason_code', () => {
    const submission = buildSubmission(
      {deterministic: leakyDeterministicDocument(), agent: leakyAgentDocument()},
      options,
    )

    const unresolvedDeterministic = submission.report.sources.deterministic!.checks.find(
      (check) => check.id === 'MISSING_TENANT_ISOLATION',
    )!
    expect(unresolvedDeterministic.reason_code).toBe('parser_unavailable')
    expect(unresolvedDeterministic).not.toHaveProperty('reason')

    for (const check of submission.report.sources.agent!.checks) {
      expect(check).not.toHaveProperty('reason')
      expect(check).not.toHaveProperty('reason_code')
      expect(check).not.toHaveProperty('analysis_mode')
    }
    expect(submission.report.sources.agent).not.toHaveProperty('detection')
    expect(submission.report.sources.agent).not.toHaveProperty('coverage')
    expect(submission.report.sources.agent!.engine).not.toHaveProperty('ruleset')
  })

  test('reduces findings to confidence and the suppressed boolean', () => {
    const submission = buildSubmission(
      {deterministic: leakyDeterministicDocument(), agent: leakyAgentDocument()},
      options,
    )

    expect(submission.report.sources.deterministic!.checks[0]!.findings).toEqual([{suppressed: false}])
    expect(submission.report.sources.agent!.checks[0]!.findings).toEqual([
      {confidence: 'high', suppressed: false},
      {confidence: 'medium', suppressed: true},
    ])
  })

  test('gives every check the time its source recorded it, the same input the combination uses', () => {
    const submission = buildSubmission(sources(), options)

    for (const check of submission.report.sources.deterministic!.checks) {
      expect(check.generated_at).toBe(deterministicFindingsDocument.generated_at)
    }
    for (const check of submission.report.sources.agent!.checks) {
      expect(check.generated_at).toBe(agentFindingsDocument.generated_at)
    }
  })

  test('reads suppression and precedence from agent documents only, as the combination does', () => {
    const input = sources()
    const [deterministicCheck] = input.deterministic.checks
    deterministicCheck!.snapshot.precedence = 'prefer-agent'
    deterministicCheck!.findings[0]!.suppression = {justification: 'Hand-edited into the deterministic file.'}

    const submission = buildSubmission(input, options)

    const [projected] = submission.report.sources.deterministic!.checks
    expect(projected!.snapshot).not.toHaveProperty('precedence')
    expect(projected!.findings[0]).toEqual({suppressed: false})
    // The agent projection is unchanged: CREDENTIAL_LOG_LEAKAGE is prefer-agent and MISSING_TENANT_ISOLATION
    // suppresses one finding.
    const agentChecks = submission.report.sources.agent!.checks
    expect(agentChecks.find((check) => check.id === 'CREDENTIAL_LOG_LEAKAGE')!.snapshot.precedence).toBe('prefer-agent')
    expect(
      agentChecks.find((check) => check.id === 'MISSING_TENANT_ISOLATION')!.findings.map((item) => item.suppressed),
    ).toEqual([false, true])
  })

  test('does not serialize any excluded value from either source', async () => {
    const forbiddenValues = await jsonFixture<string[]>('submission-forbidden-values.json')
    const leakyDocuments = {deterministic: leakyDeterministicDocument(), agent: leakyAgentDocument()}
    const documentsSerialized = JSON.stringify(leakyDocuments)
    const serialized = JSON.stringify(buildSubmission(leakyDocuments, {...options, feedback: undefined}))

    expect(forbiddenValues.length).toBeGreaterThan(0)
    for (const forbiddenValue of forbiddenValues) {
      // Every sentinel must be present in the input, or the assertion below proves nothing.
      expect(documentsSerialized).toContain(forbiddenValue)
      expect(serialized).not.toContain(forbiddenValue)
    }
  })

  test('does not include attestation, hashes, or per-file detail', () => {
    const serialized = JSON.stringify(buildSubmission(sources(), options))

    for (const removedField of [
      'attestation',
      'input_hash',
      'fingerprint',
      'justification',
      'prompt_hash',
      'implementations',
      'inspected_file_count',
      'commit',
    ])
      expect(serialized).not.toContain(removedField)
  })

  test('does not modify the source documents', () => {
    const input = sources()
    const original = structuredClone(input)

    buildSubmission(input, options)

    expect(input).toEqual(original)
  })

  test('emits a null version tag and feedback when neither is supplied', () => {
    const submission = buildSubmission(sources(), {cliVersion: '3.99.0', submittedAt: '2026-09-01T09:30:00.000Z'})

    expect(submission.report.metadata).toEqual({version_tag: null})
    expect(submission.report.feedback).toBeNull()
  })

  test('redacts every free-text output field in both sources', () => {
    const secret = 'AKIA1234567890ABCDEF'

    const submission = buildSubmission(sourcesWithSecretInFreeText(secret), {
      cliVersion: '3.99.0',
      submittedAt: '2026-09-01T09:30:00.000Z',
      versionTag: `version-${secret}`,
    })
    const serialized = JSON.stringify(submission)

    expect(serialized).not.toContain(secret)
    expect(submission.report.sources.deterministic!.checks[0]!.snapshot.title).toContain('[REDACTED:20]')
    expect(submission.report.sources.deterministic!.engine.ruleset).toContain('[REDACTED:20]')
    expect(submission.report.sources.agent!.checks[0]!.snapshot.title).toContain('[REDACTED:20]')
    expect(submission.report.sources.agent!.engine.name).toContain('[REDACTED:20]')
    expect(submission.report.metadata.version_tag).toContain('[REDACTED:20]')
  })

  test('redacts check IDs, reason codes and gap check IDs a hand-edited file could carry', () => {
    const secret = 'AKIA1234567890ABCDEF'
    const input = sources()
    input.deterministic.checks[0]!.id = secret
    input.deterministic.checks[1]!.reason = {code: secret, message: 'Hand-edited.'}
    input.deterministic.coverage.gaps = [{code: 'unresolved_check', message: 'Hand-edited.', check_id: secret}]
    input.agent.checks[0]!.id = secret

    const submission = buildSubmission(input, options)
    const deterministic = submission.report.sources.deterministic!

    expect(JSON.stringify(submission.report.sources)).not.toContain(secret)
    expect(deterministic.checks[0]!.id).toContain('[REDACTED:20]')
    expect(deterministic.checks[1]!.reason_code).toContain('[REDACTED:20]')
    expect(deterministic.coverage!.gaps).toEqual([
      {code: 'unresolved_check', check_id: expect.stringContaining('[REDACTED:20]')},
    ])
    expect(submission.report.sources.agent!.checks[0]!.id).toContain('[REDACTED:20]')
  })

  test('preserves feedback exactly without applying the free-text redactor', () => {
    const feedback = 'The result for /Users/example/app included AKIA1234567890ABCDEF inaccurately.'

    const submission = buildSubmission(sources(), {...options, feedback})

    expect(submission.report.feedback).toBe(feedback)
  })
})
