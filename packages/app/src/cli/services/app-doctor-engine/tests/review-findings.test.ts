import {
  AppDoctorAgentFindingsError,
  describeAppDoctorAgentFindingsDocument,
  parseAppDoctorAgentFindingsDocument,
} from '../review/findings.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorAgentFindingInput, AppDoctorAgentFindingsDocument} from '../review/findings.js'

const finding: AppDoctorAgentFindingInput = {
  title: 'Shop scope taken from the request',
  message: 'The loader trusts the `shop` query parameter instead of the authenticated session.',
  severity: 'high',
  location: {file: 'app/routes/orders.tsx', line: 42, column: 7},
  evidence: [{location: {file: 'app/routes/orders.tsx', line: 42}, quote: 'const shop = url.searchParams.get("shop")'}],
  snippet: 'const shop = url.searchParams.get("shop")',
  fix: {description: 'Read the shop from the authenticated admin session instead.'},
  agent_confidence: 'high',
  agent_reasoning: 'The parameter flows into the tenant filter with no session check.',
}

const document: AppDoctorAgentFindingsDocument = {
  schema_version: 1,
  review: 'adr1.eyJ2ZXJzaW9uIjoxfQ',
  checks: [
    {check_id: 'CLEAN_CHECK', outcome: 'clean', inspected_files: ['app/shopify.server.ts'], findings: []},
    {check_id: 'FINDINGS_CHECK', outcome: 'findings', inspected_files: ['app/routes/orders.tsx'], findings: [finding]},
    {check_id: 'NOT_APPLICABLE_CHECK', outcome: 'not_applicable', inspected_files: [], findings: []},
    {
      check_id: 'UNRESOLVED_CHECK',
      outcome: 'unresolved',
      inspected_files: ['app/routes/webhooks.tsx'],
      reason: 'The webhook handler delegates to a compiled dependency that could not be read.',
      guidance: 'Review the dependency source or vendor it into the repository.',
      findings: [],
    },
  ],
}

const withCheck = (index: number, patch: Record<string, unknown>) => ({
  ...document,
  checks: document.checks.map((check, position) => (position === index ? {...check, ...patch} : check)),
})

function expectFindingsError(value: unknown, messagePart: string) {
  expect(() => parseAppDoctorAgentFindingsDocument(value)).toThrow(AppDoctorAgentFindingsError)
  expect(() => parseAppDoctorAgentFindingsDocument(value)).toThrow(messagePart)
}

describe('parseAppDoctorAgentFindingsDocument', () => {
  test('accepts a document covering every outcome', () => {
    expect(parseAppDoctorAgentFindingsDocument(document)).toEqual(document)
  })

  test('requires a non-empty review token', () => {
    expectFindingsError({...document, review: ''}, 'review')
    expectFindingsError({...document, review: '   '}, 'review')
    expectFindingsError({...document, review: undefined}, 'review')
  })

  test('requires findings exactly when the outcome is findings', () => {
    expectFindingsError(withCheck(1, {findings: []}), 'checks.1.findings')
    expectFindingsError(withCheck(0, {findings: [finding]}), 'checks.0.findings')
    expectFindingsError(withCheck(2, {findings: [finding]}), 'checks.2.findings')
  })

  test('requires reason and guidance exactly when the outcome is unresolved', () => {
    expectFindingsError(withCheck(3, {reason: undefined}), 'checks.3.reason')
    expectFindingsError(withCheck(3, {guidance: undefined}), 'checks.3.guidance')
    expectFindingsError(withCheck(3, {reason: '  '}), 'checks.3.reason')
    expectFindingsError(withCheck(0, {reason: 'unexpected'}), 'checks.0.reason')
    expectFindingsError(withCheck(1, {guidance: 'unexpected'}), 'checks.1.guidance')
  })

  test('rejects duplicate check ids', () => {
    expectFindingsError(withCheck(0, {check_id: 'UNRESOLVED_CHECK'}), 'checks.3.check_id: must be unique')
  })

  test('rejects unknown keys at every level without echoing them', () => {
    expectFindingsError({...document, extra: 1}, 'document: unrecognized keys')
    expect(() => parseAppDoctorAgentFindingsDocument({...document, extra: 1})).not.toThrow('extra')
    expectFindingsError(withCheck(0, {status: 'executed'}), 'checks.0: unrecognized keys')
    expectFindingsError(withCheck(1, {findings: [{...finding, code: 'X'}]}), 'checks.1.findings.0')
    expectFindingsError(withCheck(1, {findings: [{...finding, fingerprint: 'sha256:abc'}]}), 'checks.1.findings.0')
    expectFindingsError(withCheck(1, {findings: [{...finding, location: {...finding.location, url: 'x'}}]}), 'location')
  })

  test('rejects CLI-owned fix fields the agent must not supply', () => {
    expectFindingsError(
      withCheck(1, {findings: [{...finding, fix: {...finding.fix, automated: false}}]}),
      'checks.1.findings.0.fix: unrecognized keys',
    )
  })

  test('rejects an unknown outcome and a wrong schema version', () => {
    expectFindingsError(withCheck(0, {outcome: 'executed'}), 'checks.0.outcome')
    expectFindingsError({...document, schema_version: 2}, 'schema_version')
  })

  test('requires scope-relative POSIX paths', () => {
    expectFindingsError(withCheck(0, {inspected_files: ['/etc/passwd']}), 'checks.0.inspected_files.0')
    expectFindingsError(withCheck(0, {inspected_files: ['../sibling/file.ts']}), 'checks.0.inspected_files.0')
    expectFindingsError(withCheck(0, {inspected_files: ['app\\routes\\x.ts']}), 'checks.0.inspected_files.0')
    expectFindingsError(withCheck(0, {inspected_files: ['C:/app/x.ts']}), 'checks.0.inspected_files.0')
    expectFindingsError(withCheck(0, {inspected_files: ['']}), 'checks.0.inspected_files.0')
    expectFindingsError(
      withCheck(1, {findings: [{...finding, location: {file: '/abs/file.ts'}}]}),
      'checks.1.findings.0.location.file',
    )
  })

  test('requires every finding field the result contract needs', () => {
    const {agent_reasoning: _reasoning, ...withoutReasoning} = finding
    const {fix: _fix, ...withoutFix} = finding
    expectFindingsError(withCheck(1, {findings: [withoutReasoning]}), 'agent_reasoning')
    expectFindingsError(withCheck(1, {findings: [withoutFix]}), 'fix')
    expectFindingsError(withCheck(1, {findings: [{...finding, title: ' '}]}), 'title')
    expectFindingsError(withCheck(1, {findings: [{...finding, severity: 'critical'}]}), 'severity')
    expectFindingsError(withCheck(1, {findings: [{...finding, location: {file: 'a.ts', line: 0}}]}), 'line')
  })

  test('rejects non-object input', () => {
    expectFindingsError(null, 'document')
    expectFindingsError('[]', 'document')
  })
})

describe('describeAppDoctorAgentFindingsDocument', () => {
  test('embeds one example document that the parser accepts', () => {
    const description = describeAppDoctorAgentFindingsDocument()
    const examples = [...description.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1]!)

    expect(examples).toHaveLength(1)
    const example: unknown = JSON.parse(examples[0]!)
    expect(parseAppDoctorAgentFindingsDocument(example)).toEqual(example)
  })

  test('documents every outcome and the conditional field rules', () => {
    const description = describeAppDoctorAgentFindingsDocument()

    for (const outcome of ['clean', 'findings', 'not_applicable', 'unresolved']) {
      expect(description).toContain(`\`${outcome}\``)
    }
    expect(description).toContain('`review`')
    expect(description).toContain('`reason`')
    expect(description).toContain('`guidance`')
    expect(description).toContain('`inspected_files`')
    expect(description).toContain('`agent_confidence`')
    expect(description).not.toContain('"$schema"')
  })
})
