import {
  AGENT_PROMPT,
  CHECK_ID,
  INSPECTED_FILE,
  SECOND_INSPECTED_FILE,
  SKIPPED_FILE,
  agentResultInput,
  findingInput,
  staticResultInput,
} from './fixtures/result-contract.js'
import {
  APP_DOCTOR_RESULT_SCHEMA_VERSION,
  APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION,
  AppDoctorResultError,
  FINDING_IDENTITY_VERSION,
  createAppDoctorResult,
  formatAppDoctorEvidencePath,
  getAppDoctorResultOutcome,
  parseAppDoctorResult,
  parseAppDoctorScopeDescriptor,
  serializeAppDoctorResult,
} from '../results/index.js'
import {canonicalJson, sha256} from '../trace/index.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorResult, AppDoctorResultInput, AppDoctorStaticResult} from '../results/index.js'

const SECRET = `shpat_${'d'.repeat(32)}`
// `JSON.parse('"\\ud800"')` yields a lone surrogate, so stored files can carry one.
const LONE_SURROGATE = JSON.parse('"\\ud800"') as string
const MALFORMED_ESCAPE = 'a%ZZ'

const staticInput = () => {
  const input = staticResultInput()
  if (input.mode !== 'static') throw new Error('fixture mode')
  return input
}
const agentInput = () => {
  const input = agentResultInput()
  if (input.mode !== 'agent') throw new Error('fixture mode')
  return input
}
const staticResult = (input: AppDoctorResultInput = staticResultInput()) =>
  createAppDoctorResult(input) as AppDoctorStaticResult

/** Assert rejection with a fixed detail, and that the message never echoes the secret fixture. */
const expectRejected = (input: AppDoctorResultInput, detail: string) => {
  expect(() => createAppDoctorResult(input)).toThrow(AppDoctorResultError)
  expect(() => createAppDoctorResult(input)).toThrow(detail)
  try {
    createAppDoctorResult(input)
  } catch (error) {
    if (!(error instanceof AppDoctorResultError)) throw error
    expect(error.message).not.toContain(SECRET)
  }
}

const expectParseErrors = (value: unknown, detail: string) => {
  const parsed = parseAppDoctorResult(value)
  expect(parsed.ok).toBe(false)
  if (parsed.ok) return
  expect(parsed.errors.join('\n')).toContain(detail)
}

/** Static input whose single implementation and execution carry the given status. */
const staticWithStatus = (
  status: AppDoctorResult['execution']['status'],
  overrides: Partial<Pick<Extract<AppDoctorResultInput, {mode: 'static'}>, 'required' | 'applicable'>> = {},
) => {
  const input = staticInput()
  input.required = overrides.required ?? true
  input.applicable = overrides.applicable ?? status !== 'not_applicable'
  input.findings = []
  input.implementations = [{id: 'only', analysis_mode: 'regex', status, inspected_files: [], findings: 0}]
  input.execution = {
    status,
    analysis_mode: 'regex',
    inspected_files: [],
    ...(status === 'executed' || status === 'not_applicable'
      ? {}
      : {reason: {code: 'parser_unavailable', message: 'No parser.'}, guidance: 'Run the agent review.'}),
  }
  input.coverage = {files_scanned: 0, files_skipped: [], unsupported_languages: [], gaps: []}
  if (input.required && (status === 'unsupported_framework' || status === 'unresolved')) {
    input.coverage.gaps = [{code: 'unresolved_check', message: 'Check did not resolve.', check_id: CHECK_ID}]
  }
  return input
}

describe('createAppDoctorResult', () => {
  test('produces stored envelopes for both modes', () => {
    const stored = staticResult()
    expect(stored.schema_version).toBe(APP_DOCTOR_RESULT_SCHEMA_VERSION)
    expect(stored.diagnostic_paths).toBe('reference-v1')
    expect(stored.scope.descriptor_version).toBe(APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION)
    expect(FINDING_IDENTITY_VERSION).toBe(1)
    expect(stored.findings[0]!.key.namespace).toBe('diagnostic-v1')
    expect(stored.findings[0]!.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)

    const agent = createAppDoctorResult(agentResultInput())
    expect(agent.mode).toBe('agent')
    if (agent.mode !== 'agent') return
    expect(agent.prompt).toBe(AGENT_PROMPT)
    expect(agent.prompt_hash).toBe(sha256(AGENT_PROMPT))
  })

  test('returns a detached copy that ignores later input mutation', () => {
    const input = staticInput()
    const stored = staticResult(input)
    input.findings[0]!.title = 'mutated'
    input.execution.inspected_files.push('anchor/0/new.ts')
    input.scope.exclusions.entries.push({base: 'storage_anchor', up: 0, path: 'dist'})
    expect(stored.findings[0]!.title).toBe('Access token written to logs')
    expect(stored.execution.inspected_files).toEqual([INSPECTED_FILE, SECOND_INSPECTED_FILE])
    expect(stored.scope.exclusions.entries).toHaveLength(1)
  })

  test('rejects values that are not plain JSON and never echoes input', () => {
    const input = staticInput()
    input.findings[0]!.title = SECRET
    ;(input as unknown as Record<string, unknown>).produced_at = new Date(input.produced_at)
    expectRejected(input, 'expected bounded plain JSON data')
  })

  test('rejects secrets in identity, prompt, and path components rather than rewriting them', () => {
    const identity = staticInput()
    identity.configuration_identity = `config-${SECRET}`
    expectRejected(identity, 'configuration_identity')

    const scope = staticInput()
    scope.scope_identity = SECRET
    expectRejected(scope, 'scope_identity')

    const prompt = agentInput()
    prompt.prompt = `Review ${SECRET}`
    prompt.prompt_hash = sha256(prompt.prompt)
    expectRejected(prompt, 'prompt')

    const path = staticInput()
    path.findings[0]!.location.file = `anchor/0/app/${SECRET}.ts`
    expectRejected(path, 'findings.0.location.file')

    const semanticKey = staticInput()
    semanticKey.findings = [{...findingInput(), key: {namespace: 'semantic-v1', value: SECRET}}]
    expectRejected(semanticKey, 'findings.0.key.value')

    const engine = staticInput()
    engine.engine.ruleset = SECRET
    expectRejected(engine, 'engine.ruleset')
  })

  test('redacts prose fields and derives keys from the redacted text', () => {
    const input = staticInput()
    input.findings = [
      {
        ...findingInput(),
        message: `Logged ${SECRET}`,
        snippet: `console.log("${SECRET}")`,
        evidence: [{location: {file: INSPECTED_FILE}, quote: SECRET}],
        fix: {automated: false, description: `Remove ${SECRET}`, guide: `See ${SECRET}`},
        detection_evidence: [SECRET],
      },
    ]
    input.execution.reason = {code: 'not_reported', message: `Reason ${SECRET}`}
    input.execution.status = 'executed'
    input.coverage.gaps[0]!.message = `Skipped ${SECRET}`
    input.coverage.files_skipped[0]!.detail = SECRET
    const stored = staticResult(input)
    expect(serializeAppDoctorResult(stored)).not.toContain(SECRET)
    expect(parseAppDoctorResult(JSON.parse(serializeAppDoctorResult(stored))).ok).toBe(true)
  })

  test('names the later duplicate finding by index, structurally, so callers need not parse the message', () => {
    const input = staticInput()
    input.findings = [{...findingInput(), title: 'Distinct'}, findingInput(), findingInput()]
    input.implementations[0]!.findings = 3

    try {
      createAppDoctorResult(input)
    } catch (error) {
      if (!(error instanceof AppDoctorResultError)) throw error
      expect(error.findingIndex).toBe(2)
      expect(error.details).toContain('findings: duplicate fingerprint')
      return
    }
    throw new Error('expected createAppDoctorResult to reject the duplicate')
  })

  test('rejects a finding whose code differs from the owning check', () => {
    const input = staticInput()
    input.findings = [{...findingInput(), code: 'OTHER_CHECK'}]
    expectRejected(input, 'code must equal the owning check ID')
  })

  test('rejects duplicate fingerprints within one result', () => {
    const input = staticInput()
    input.findings = [findingInput(), findingInput()]
    input.implementations[0]!.findings = 2
    expectRejected(input, 'duplicate fingerprint')

    const distinct = staticInput()
    distinct.findings = [findingInput(), {...findingInput(), title: 'Second finding'}]
    distinct.implementations[0]!.findings = 2
    expect(createAppDoctorResult(distinct).findings).toHaveLength(2)
  })

  test('allows the same fingerprint across modes', () => {
    const fromStatic = staticResult().findings[0]!.fingerprint
    const agent = agentInput()
    agent.findings = [{...findingInput(), confidence: 'agentic'}]
    expect(createAppDoctorResult(agent).findings[0]!.fingerprint).toBe(fromStatic)
  })

  test('requires agent findings to be agentic and rejects agent fields on static findings', () => {
    const agent = agentInput()
    agent.findings = [{...findingInput(), confidence: 'definite'}]
    expectRejected(agent, 'agentic confidence')

    const staticWithReasoning = staticInput()
    staticWithReasoning.findings = [{...findingInput(), agent_reasoning: 'why'}]
    expectRejected(staticWithReasoning, 'static findings must not carry agent confidence or reasoning')
  })

  test('requires the prompt hash to match the prompt', () => {
    const agent = agentInput()
    agent.prompt_hash = sha256('another prompt')
    expectRejected(agent, 'prompt_hash')
  })
})

describe('execution invariants', () => {
  test('executed regex, ast, and agent checks must inspect a file; structured_config may not', () => {
    for (const analysisMode of ['regex', 'ast'] as const) {
      const input = staticWithStatus('executed')
      input.execution.analysis_mode = analysisMode
      expectRejected(input, 'must inspect at least one file')
    }
    const structured = staticWithStatus('executed')
    structured.execution.analysis_mode = 'structured_config'
    structured.implementations[0]!.analysis_mode = 'structured_config'
    expect(getAppDoctorResultOutcome(createAppDoctorResult(structured))).toBe('clean')

    const agent = agentInput()
    agent.findings = []
    agent.execution.inspected_files = []
    expectRejected(agent, 'must inspect at least one file')
  })

  test('not_applicable is equivalent to applicable: false', () => {
    expect(getAppDoctorResultOutcome(createAppDoctorResult(staticWithStatus('not_applicable')))).toBe('not_applicable')
    expectRejected(staticWithStatus('not_applicable', {applicable: true}), 'requires applicable to be false')
    const executedButInapplicable = staticInput()
    executedButInapplicable.applicable = false
    expectRejected(executedButInapplicable, 'executed checks must be applicable')
    expectRejected(staticWithStatus('unresolved', {applicable: false}), 'must be applicable')
  })

  test('unsupported and unresolved require reason and guidance', () => {
    for (const status of ['unsupported_framework', 'unresolved'] as const) {
      const noReason = staticWithStatus(status)
      delete noReason.execution.reason
      expectRejected(noReason, 'require a reason')
      const noGuidance = staticWithStatus(status)
      delete noGuidance.execution.guidance
      expectRejected(noGuidance, 'require guidance')
      expect(getAppDoctorResultOutcome(createAppDoctorResult(staticWithStatus(status)))).toBe(status)
    }
  })

  test('unresolved may retain findings; unsupported and not_applicable may not', () => {
    const withFinding = (status: 'unresolved' | 'unsupported_framework' | 'not_applicable') => {
      const input = staticWithStatus(status)
      input.findings = [findingInput()]
      input.implementations[0]!.findings = 1
      return input
    }
    expect(createAppDoctorResult(withFinding('unresolved')).findings).toHaveLength(1)
    expectRejected(withFinding('unsupported_framework'), 'must not retain findings')
    expectRejected(withFinding('not_applicable'), 'must not retain findings')
  })

  test('agent results may be not_applicable with no findings and no inspected files', () => {
    const agent = agentInput()
    agent.findings = []
    agent.execution = {
      status: 'not_applicable',
      analysis_mode: 'agent',
      inspected_files: [],
      guidance: 'Nothing to do.',
    }
    expect(getAppDoctorResultOutcome(createAppDoctorResult(agent))).toBe('not_applicable')

    const withFinding = agentInput()
    withFinding.execution = {...withFinding.execution, status: 'not_applicable'}
    expectRejected(withFinding, 'must not retain findings')
  })

  test('agent results may be unresolved with reason and guidance', () => {
    const agent = agentInput()
    agent.findings = []
    agent.execution = {
      status: 'unresolved',
      analysis_mode: 'agent',
      inspected_files: [],
      reason: {code: 'agent_investigation_required', message: 'Needs a human.'},
      guidance: 'Escalate.',
    }
    expect(getAppDoctorResultOutcome(createAppDoctorResult(agent))).toBe('unresolved')
    delete agent.execution.reason
    expectRejected(agent, 'require a reason')
  })
})

describe('implementation invariants', () => {
  test('finding counts must sum to the number of findings', () => {
    const input = staticInput()
    input.implementations[0]!.findings = 2
    expectRejected(input, 'finding counts must sum')
  })

  test('inspected files must match the execution union', () => {
    const missing = staticInput()
    missing.execution.inspected_files = [INSPECTED_FILE]
    expectRejected(missing, 'inspected files must match')

    const extra = staticInput()
    extra.execution.inspected_files.push('anchor/0/other.ts')
    expectRejected(extra, 'inspected files must match')

    const overlapping = staticInput()
    overlapping.implementations[1]!.inspected_files = [INSPECTED_FILE, SECOND_INSPECTED_FILE]
    expect(createAppDoctorResult(overlapping).mode).toBe('static')
  })

  test('aggregate status must agree with implementations', () => {
    const mixed = staticWithStatus('unresolved')
    mixed.implementations = [
      {id: 'a', analysis_mode: 'regex', status: 'unresolved', inspected_files: [], findings: 0},
      {id: 'b', analysis_mode: 'ast', status: 'not_applicable', inspected_files: [], findings: 0},
    ]
    expectRejected(mixed, 'aggregate status')

    const oneExecuted = staticInput()
    oneExecuted.implementations[1]!.status = 'unresolved'
    oneExecuted.implementations[1]!.reason = {code: 'parser_unavailable', message: 'No AST parser.'}
    expect(createAppDoctorResult(oneExecuted).execution.status).toBe('executed')

    const claimsExecuted = staticWithStatus('unresolved')
    claimsExecuted.execution.status = 'executed'
    claimsExecuted.execution.inspected_files = [INSPECTED_FILE]
    claimsExecuted.implementations[0]!.inspected_files = [INSPECTED_FILE]
    claimsExecuted.coverage.gaps = []
    expectRejected(claimsExecuted, 'aggregate status')
  })

  test('at least one implementation is required', () => {
    const input = staticInput()
    input.implementations = []
    expectRejected(input, 'implementations')
  })
})

describe('coverage invariants', () => {
  test('skipped files and skipped_file gaps correspond one-to-one', () => {
    const missingGap = staticInput()
    missingGap.coverage.gaps = missingGap.coverage.gaps.filter((gap) => gap.code !== 'skipped_file')
    expectRejected(missingGap, 'skipped files and skipped_file gaps')

    const missingFile = staticInput()
    missingFile.coverage.files_skipped = []
    expectRejected(missingFile, 'skipped files and skipped_file gaps')

    const gapWithoutFile = staticInput()
    delete gapWithoutFile.coverage.gaps[0]!.file
    expectRejected(gapWithoutFile, 'skipped_file gaps require a file')

    const differentFile = staticInput()
    differentFile.coverage.gaps[0]!.file = 'anchor/0/app/other.js'
    expectRejected(differentFile, 'skipped files and skipped_file gaps')

    const duplicated = staticInput()
    duplicated.coverage.gaps.push({code: 'skipped_file', message: 'again', file: SKIPPED_FILE})
    expectRejected(duplicated, 'skipped files and skipped_file gaps')
  })

  test('unsupported languages and unsupported_language gaps correspond one-to-one', () => {
    const missingGap = staticInput()
    missingGap.coverage.gaps = missingGap.coverage.gaps.filter((gap) => gap.code !== 'unsupported_language')
    expectRejected(missingGap, 'unsupported languages and unsupported_language gaps')

    const missingLanguage = staticInput()
    missingLanguage.coverage.unsupported_languages = []
    expectRejected(missingLanguage, 'unsupported languages and unsupported_language gaps')
  })

  test('unresolved_check gaps belong only to required unresolved checks and name themselves', () => {
    const optional = staticWithStatus('unresolved', {required: false})
    expect(createAppDoctorResult(optional).mode).toBe('static')
    optional.coverage.gaps = [{code: 'unresolved_check', message: 'x', check_id: CHECK_ID}]
    expectRejected(optional, 'only required unresolved checks')

    const required = staticWithStatus('unsupported_framework')
    required.coverage.gaps = []
    expectRejected(required, 'exactly one unresolved_check gap')

    const twoGaps = staticWithStatus('unresolved')
    twoGaps.coverage.gaps = [
      {code: 'unresolved_check', message: 'x', check_id: CHECK_ID},
      {code: 'unresolved_check', message: 'y', check_id: CHECK_ID},
    ]
    expectRejected(twoGaps, 'exactly one unresolved_check gap')

    const anonymous = staticWithStatus('unresolved')
    anonymous.coverage.gaps = [{code: 'unresolved_check', message: 'x'}]
    expectRejected(anonymous, 'exactly one unresolved_check gap')

    const otherCheck = staticWithStatus('unresolved')
    otherCheck.coverage.gaps = [{code: 'unresolved_check', message: 'x', check_id: 'OTHER_CHECK'}]
    expectRejected(otherCheck, 'must not reference other checks')

    const executedWithGap = staticInput()
    executedWithGap.coverage.gaps.push({code: 'unresolved_check', message: 'x', check_id: CHECK_ID})
    expectRejected(executedWithGap, 'only required unresolved checks')
  })

  test('files_scanned must be a nonnegative integer', () => {
    const negative = staticInput()
    negative.coverage.files_scanned = -1
    expectRejected(negative, 'coverage.files_scanned')
    const fractional = staticInput()
    fractional.coverage.files_scanned = 1.5
    expectRejected(fractional, 'coverage.files_scanned')
  })
})

describe('getAppDoctorResultOutcome', () => {
  test('follows the outcome table', () => {
    expect(getAppDoctorResultOutcome(undefined)).toBe('not_run')
    expect(getAppDoctorResultOutcome(staticResult())).toBe('findings')
    const clean = staticInput()
    clean.findings = []
    clean.implementations[0]!.findings = 0
    expect(getAppDoctorResultOutcome(createAppDoctorResult(clean))).toBe('clean')
    expect(getAppDoctorResultOutcome(createAppDoctorResult(staticWithStatus('not_applicable')))).toBe('not_applicable')
    expect(getAppDoctorResultOutcome(createAppDoctorResult(staticWithStatus('unsupported_framework')))).toBe(
      'unsupported_framework',
    )
    expect(getAppDoctorResultOutcome(createAppDoctorResult(staticWithStatus('unresolved')))).toBe('unresolved')
    expect(getAppDoctorResultOutcome(createAppDoctorResult(agentResultInput()))).toBe('findings')
  })
})

describe('parseAppDoctorResult and serializeAppDoctorResult', () => {
  test('round trips both modes through canonical JSON', () => {
    for (const input of [staticResultInput(), agentResultInput()]) {
      const stored = createAppDoctorResult(input)
      const serialized = serializeAppDoctorResult(stored)
      expect(serialized.endsWith('\n')).toBe(true)
      expect(serialized).toBe(`${canonicalJson(stored)}\n`)
      const parsed = parseAppDoctorResult(JSON.parse(serialized))
      expect(parsed).toEqual({ok: true, result: stored})
    }
  })

  test('rejects non-JSON, unknown fields, and wrong versions', () => {
    const stored = staticResult()
    expectParseErrors(undefined, 'expected bounded plain JSON data')
    expectParseErrors({...stored, extra: true}, 'unrecognized keys')
    expectParseErrors({...stored, schema_version: 2}, 'schema_version')
    expectParseErrors({...stored, diagnostic_paths: 'legacy'}, 'diagnostic_paths')
    expectParseErrors({...stored, scope: {...stored.scope, descriptor_version: 0}}, 'scope.descriptor_version')
    const {scope: _scope, ...withoutScope} = stored
    expectParseErrors(withoutScope, 'scope')
  })

  test('rejects unredacted or non-normalized stored values without repairing them', () => {
    const stored = staticResult()
    const finding = stored.findings[0]!
    expectParseErrors(
      {...stored, findings: [{...finding, message: `Logged ${SECRET}`}]},
      'unredacted or non-normalized values',
    )
    const parsed = parseAppDoctorResult({...stored, findings: [{...finding, message: `Logged ${SECRET}`}]})
    if (parsed.ok) throw new Error('expected rejection')
    expect(parsed.errors.join('\n')).not.toContain(SECRET)

    expectParseErrors(
      {...stored, execution: {...stored.execution, inspected_files: ['anchor\\0\\app\\file.ts']}},
      'inspected_files',
    )
  })

  test('rejects forged diagnostic keys and fingerprints', () => {
    const stored = staticResult()
    const finding = stored.findings[0]!
    expectParseErrors(
      {...stored, findings: [{...finding, key: {namespace: 'diagnostic-v1', value: `sha256:${'0'.repeat(64)}`}}]},
      'findings.0.key',
    )
    expectParseErrors(
      {...stored, findings: [{...finding, fingerprint: `sha256:${'0'.repeat(64)}`}]},
      'findings.0.fingerprint',
    )
    // Changing content without re-deriving the key is a forgery too.
    expectParseErrors({...stored, findings: [{...finding, title: 'Edited title'}]}, 'findings.0.key')
    // A semantic key is preserved verbatim, so only the fingerprint binds it.
    const semantic = staticInput()
    semantic.findings = [{...findingInput(), key: {namespace: 'semantic-v1', value: 'route'}}]
    const semanticStored = staticResult(semantic)
    expectParseErrors(
      {...semanticStored, findings: [{...semanticStored.findings[0], key: {namespace: 'semantic-v1', value: 'other'}}]},
      'findings.0.fingerprint',
    )
  })

  test('rejects duplicate fingerprints and other invariant violations in stored data', () => {
    const stored = staticResult()
    const duplicated = {
      ...stored,
      findings: [stored.findings[0], stored.findings[0]],
      implementations: [{...stored.implementations[0], findings: 2}, stored.implementations[1]],
    }
    expectParseErrors(duplicated, 'duplicate fingerprint')
    expectParseErrors({...stored, applicable: false}, 'executed checks must be applicable')
  })
})

describe('hostile stored paths', () => {
  const hostileScopes = (): {label: string; scope: AppDoctorResult['scope']}[] => {
    const scope = () => staticResult().scope
    return [
      {
        label: 'malformed escape in directory',
        scope: {...scope(), directory: {base: 'storage_anchor', up: 0, path: MALFORMED_ESCAPE}},
      },
      {
        label: 'malformed escape in app_directory',
        scope: {...scope(), app_directory: {base: 'storage_anchor', up: 0, path: MALFORMED_ESCAPE}},
      },
      {
        label: 'lone surrogate in directory',
        scope: {...scope(), directory: {base: 'storage_anchor', up: 0, path: LONE_SURROGATE}},
      },
      {
        label: 'lone surrogate in app_directory',
        scope: {...scope(), app_directory: {base: 'storage_anchor', up: 0, path: LONE_SURROGATE}},
      },
    ]
  }

  test('parsers reject undecodable path components without throwing', () => {
    for (const {scope} of hostileScopes()) {
      expect(parseAppDoctorScopeDescriptor(scope).ok).toBe(false)
      expect(parseAppDoctorResult({...staticResult(), scope}).ok).toBe(false)
    }
    const stored = staticResult()
    const finding = stored.findings[0]!
    expect(
      parseAppDoctorResult({...stored, findings: [{...finding, location: {...finding.location, file: LONE_SURROGATE}}]})
        .ok,
    ).toBe(false)
  })

  test('constructor rejects undecodable path components with AppDoctorResultError', () => {
    for (const {scope} of hostileScopes()) {
      const input = staticInput()
      input.scope = scope
      expect(() => createAppDoctorResult(input)).toThrow(AppDoctorResultError)
    }
    const input = staticInput()
    input.findings[0]!.location.file = `anchor/0/${LONE_SURROGATE}`
    expect(() => createAppDoctorResult(input)).toThrow(AppDoctorResultError)
  })

  test('formatAppDoctorEvidencePath rejects a lone-surrogate file with AppDoctorResultError', () => {
    expect(() => formatAppDoctorEvidencePath({base: 'storage_anchor', up: 0, path: '.'}, LONE_SURROGATE)).toThrow(
      AppDoctorResultError,
    )
    expect(() => formatAppDoctorEvidencePath({base: 'storage_anchor', up: 0, path: LONE_SURROGATE}, 'file.ts')).toThrow(
      AppDoctorResultError,
    )
  })
})
