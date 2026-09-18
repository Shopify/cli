import {
  CHECK_ID,
  CONFIGURATION_IDENTITY,
  INSPECTED_FILE,
  SCOPE_IDENTITY,
  agentResultInput,
  findingInput,
  staticResultInput,
} from './fixtures/result-contract.js'
import {computeAppDoctorFindingFingerprint, createAppDoctorResult, AppDoctorResultError} from '../results/index.js'
import {describe, expect, test} from 'vitest'
import {createHash} from 'node:crypto'

const independentSha256 = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
const SECRET = `shpat_${'c'.repeat(32)}`

describe('diagnostic finding keys', () => {
  test('encode exactly the diagnostic payload with null for absent optional fields', () => {
    const input = staticResultInput()
    const {snippet: _snippet, detection_evidence: _evidence, ...withoutOptionalFields} = findingInput()
    input.findings = [
      {
        ...withoutOptionalFields,
        location: {file: INSPECTED_FILE, line: 12},
        evidence: [{location: {file: INSPECTED_FILE}}],
        fix: {automated: true, description: 'Fix it.'},
      },
    ]
    const result = createAppDoctorResult(input)
    const finding = result.findings[0]!

    const expectedPayload =
      '["shopify-app-doctor/diagnostic/v1",{' +
      '"detection_evidence":null,' +
      `"evidence":[{"location":{"column":null,"file":"${INSPECTED_FILE}","line":null},"quote":null}],` +
      '"fix":{"automated":true,"description":"Fix it.","guide":null},' +
      `"location":{"column":null,"file":"${INSPECTED_FILE}","line":12},` +
      '"message":"The offline access token is passed to console.log.",' +
      '"snippet":null,' +
      '"title":"Access token written to logs"}]'
    expect(finding.key).toEqual({namespace: 'diagnostic-v1', value: independentSha256(expectedPayload)})
  })

  test('distinguish explicit empty values from absent ones', () => {
    const withEmpty = staticResultInput()
    withEmpty.findings = [{...findingInput(), snippet: '', detection_evidence: []}]
    const withAbsent = staticResultInput()
    const {snippet: _snippet, detection_evidence: _evidence, ...absent} = findingInput()
    withAbsent.findings = [absent]
    expect(createAppDoctorResult(withEmpty).findings[0]!.key.value).not.toBe(
      createAppDoctorResult(withAbsent).findings[0]!.key.value,
    )
  })

  test('ignore severity, points, confidence, agent reasoning, versions, prompt, and mode', () => {
    const baseline = createAppDoctorResult(staticResultInput()).findings[0]!.key
    const changed = staticResultInput()
    changed.check_version = 9
    changed.engine.version = '4.0.0'
    changed.findings = [{...findingInput(), severity: 'low', points: -1, confidence: 'needs_review'}]
    expect(createAppDoctorResult(changed).findings[0]!.key).toEqual(baseline)

    const agent = agentResultInput()
    if (agent.mode !== 'agent') throw new Error('fixture mode')
    agent.prompt = 'A different prompt.'
    agent.prompt_hash = independentSha256(agent.prompt)
    agent.findings = [{...findingInput(), confidence: 'agentic', agent_confidence: 'low', agent_reasoning: 'Other.'}]
    expect(createAppDoctorResult(agent).findings[0]!.key).toEqual(baseline)
  })

  test('preserve prose, whitespace, case, and evidence order', () => {
    const baseline = createAppDoctorResult(staticResultInput()).findings[0]!.key.value
    const spaced = staticResultInput()
    spaced.findings = [{...findingInput(), title: 'Access token written to logs '}]
    expect(createAppDoctorResult(spaced).findings[0]!.key.value).not.toBe(baseline)

    const reordered = staticResultInput()
    reordered.findings = [{...findingInput(), detection_evidence: ['b', 'a']}]
    const ordered = staticResultInput()
    ordered.findings = [{...findingInput(), detection_evidence: ['a', 'b']}]
    expect(createAppDoctorResult(reordered).findings[0]!.key.value).not.toBe(
      createAppDoctorResult(ordered).findings[0]!.key.value,
    )
  })

  test('are derived after path normalization and redaction', () => {
    const windowsPaths = staticResultInput()
    windowsPaths.findings = [
      {
        ...findingInput(),
        location: {file: 'anchor\\0\\app\\routes\\webhooks.tsx', line: 12, column: 5},
        evidence: [{location: {file: 'anchor\\0\\app\\routes\\webhooks.tsx', line: 12}, quote: 'q'}],
      },
    ]
    const portablePaths = staticResultInput()
    portablePaths.findings = [{...findingInput(), evidence: [{location: {file: INSPECTED_FILE, line: 12}, quote: 'q'}]}]
    expect(createAppDoctorResult(windowsPaths).findings[0]!.key).toEqual(
      createAppDoctorResult(portablePaths).findings[0]!.key,
    )
    expect(createAppDoctorResult(windowsPaths).findings[0]!.location.file).toBe(INSPECTED_FILE)

    const secretTitle = staticResultInput()
    secretTitle.findings = [{...findingInput(), title: `Token ${SECRET} logged`}]
    const stored = createAppDoctorResult(secretTitle).findings[0]!
    expect(stored.title).not.toContain(SECRET)
    expect(stored.title).toContain('[REDACTED')
    const redactedTitle = staticResultInput()
    redactedTitle.findings = [{...findingInput(), title: stored.title}]
    expect(createAppDoctorResult(redactedTitle).findings[0]!.key).toEqual(stored.key)
  })

  test('semantic keys are preserved verbatim and skip diagnostic derivation', () => {
    const input = staticResultInput()
    input.findings = [{...findingInput(), key: {namespace: 'semantic-v1', value: ' Route:Webhooks '}}]
    const finding = createAppDoctorResult(input).findings[0]!
    expect(finding.key).toEqual({namespace: 'semantic-v1', value: ' Route:Webhooks '})
  })
})

describe('finding fingerprints', () => {
  test('encode the identity tuple without mode', () => {
    const key = {namespace: 'semantic-v1', value: 'route:webhooks'} as const
    const fingerprint = computeAppDoctorFindingFingerprint({
      configurationIdentity: CONFIGURATION_IDENTITY,
      scopeIdentity: SCOPE_IDENTITY,
      code: CHECK_ID,
      key,
    })
    const expected = independentSha256(
      `["shopify-app-doctor/finding/v1","${CONFIGURATION_IDENTITY}","${SCOPE_IDENTITY}","${CHECK_ID}","semantic-v1","route:webhooks"]`,
    )
    expect(fingerprint).toBe(expected)

    const staticInput = staticResultInput()
    staticInput.findings = [{...findingInput(), key}]
    const agentInput = agentResultInput()
    agentInput.findings = [{...findingInput(), key, confidence: 'agentic'}]
    expect(createAppDoctorResult(staticInput).findings[0]!.fingerprint).toBe(expected)
    expect(createAppDoctorResult(agentInput).findings[0]!.fingerprint).toBe(expected)
  })

  test('change with every identity component', () => {
    const base = {
      configurationIdentity: CONFIGURATION_IDENTITY,
      scopeIdentity: SCOPE_IDENTITY,
      code: CHECK_ID,
      key: {namespace: 'semantic-v1', value: 'k'} as const,
    }
    const baseline = computeAppDoctorFindingFingerprint(base)
    expect(computeAppDoctorFindingFingerprint({...base, configurationIdentity: 'd'.repeat(32)})).not.toBe(baseline)
    expect(computeAppDoctorFindingFingerprint({...base, scopeIdentity: `sha256:${'d'.repeat(64)}`})).not.toBe(baseline)
    expect(computeAppDoctorFindingFingerprint({...base, code: 'OTHER_CHECK'})).not.toBe(baseline)
    expect(computeAppDoctorFindingFingerprint({...base, key: {namespace: 'semantic-v1', value: 'K'}})).not.toBe(
      baseline,
    )
    expect(
      computeAppDoctorFindingFingerprint({
        ...base,
        key: {namespace: 'diagnostic-v1', value: `sha256:${'0'.repeat(64)}`},
      }),
    ).not.toBe(baseline)
  })

  test('reject invalid identity components without echoing them', () => {
    const attempt = (overrides: Record<string, unknown>) => () =>
      computeAppDoctorFindingFingerprint({
        configurationIdentity: CONFIGURATION_IDENTITY,
        scopeIdentity: SCOPE_IDENTITY,
        code: CHECK_ID,
        key: {namespace: 'semantic-v1', value: 'k'},
        ...overrides,
      } as Parameters<typeof computeAppDoctorFindingFingerprint>[0])
    expect(attempt({configurationIdentity: ''})).toThrow(AppDoctorResultError)
    expect(attempt({scopeIdentity: '  '})).toThrow(AppDoctorResultError)
    expect(attempt({code: SECRET})).toThrow(AppDoctorResultError)
    expect(attempt({key: {namespace: 'diagnostic-v1', value: 'sha256:short'}})).toThrow(AppDoctorResultError)
    expect(attempt({key: {namespace: 'other', value: 'k'}})).toThrow(AppDoctorResultError)
    try {
      attempt({code: SECRET})()
    } catch (error) {
      if (!(error instanceof AppDoctorResultError)) throw error
      expect(error.message).not.toContain(SECRET)
    }
  })
})
