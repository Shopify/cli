/* eslint-disable id-length -- concise fixture names keep provenance-focused assertions readable */
import {
  loadChecks,
  buildReviewPack,
  validateFinding,
  findingToIssue,
  mergeFindings,
  validateAgentChecksExecuted,
  type AgentFinding,
} from '../checks/index.js'
import {EMBEDDED_CHECK_SOURCES} from '../checks/embedded.js'
import {describe, expect, test} from 'vitest'
import {readFileSync, readdirSync} from 'node:fs'

const EXPECTED_CHECK_IDS = [
  'APP_PROXY_UNVERIFIED_SIGNATURE',
  'CSRF_MISSING_PROTECTION',
  'MISSING_AUTHORIZATION_CHECK',
  'MISSING_EMBEDDED_CSP',
  'MISSING_TENANT_ISOLATION',
  'OPEN_REDIRECT',
  'OVERBROAD_DATA_ACCESS',
  'REQUEST_DERIVED_SHOP_SCOPE',
  'SCOPE_OVER_REQUEST',
  'SCRIPT_TAG_URL_INJECTION',
  'SSRF_REQUEST_FORGERY',
  'TEXT_SETTING_HTML_SMUGGLING',
  'THEME_EXTENSION_XSS',
  'UNAUTHENTICATED_ENDPOINT',
  'UNSAFE_INNERHTML',
  'UNSCOPED_SHOP_CONFIG_WRITE',
]

const validFinding: AgentFinding = {
  check_id: 'MISSING_TENANT_ISOLATION',
  check_version: 1,
  prompt_hash: 'sha256:test-provenance',
  file: 'app/controllers/orders_controller.rb',
  line: 42,
  message: 'Query not scoped to current shop',
  snippet: 'Product.where(id: params[:id])',
  evidence: [
    {
      file: 'app/controllers/orders_controller.rb',
      line: 42,
      quote: 'Product.where(id: params[:id])',
    },
  ],
  confidence: 'high',
  reasoning: 'No before_action scopes by shop_id',
}

describe('check loading', () => {
  test('keeps the generated prompt sources in exact parity with markdown', () => {
    const checksDir = new URL('../checks/', import.meta.url)
    const markdownSources = readdirSync(checksDir)
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((file) => readFileSync(new URL(file, checksDir), 'utf8'))

    expect(EMBEDDED_CHECK_SOURCES).toEqual(markdownSources)
  })

  test('loads all versioned checks with frontmatter parsed', () => {
    const checks = loadChecks()
    expect([...checks.keys()]).toEqual(EXPECTED_CHECK_IDS)
    expect(checks.size).toBe(16)
    const tenant = checks.get('MISSING_TENANT_ISOLATION')
    expect(tenant).toBeDefined()
    expect(tenant!.version).toBeGreaterThanOrEqual(1)
    expect(tenant!.severity).toBe('high')
    expect(tenant!.prompt.length).toBeGreaterThan(200)
    expect(tenant!.tier).toBe('agentic')
  })

  test('does not carry candidate_source — the agent explores independently', () => {
    const checks = loadChecks()
    const tenant = checks.get('MISSING_TENANT_ISOLATION')!
    expect((tenant as unknown as Record<string, unknown>).candidate_source).toBeUndefined()
  })

  test('hashes the prompt so a finding is traceable to exact wording', () => {
    const a = loadChecks().get('MISSING_TENANT_ISOLATION')!
    const b = loadChecks().get('MISSING_TENANT_ISOLATION')!
    expect(a.prompt_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(a.prompt_hash).toBe(b.prompt_hash)
  })
})

describe('review pack', () => {
  test('contains prompts, not candidates', () => {
    const pack = buildReviewPack('0.1.0')
    expect(pack.checks.map((check) => check.id)).toEqual(EXPECTED_CHECK_IDS)
    expect(pack.checks).toHaveLength(16)
    expect((pack as unknown as Record<string, unknown>).candidates).toBeUndefined()
    const tenant = pack.checks.find((c) => c.id === 'MISSING_TENANT_ISOLATION')
    expect(tenant).toBeDefined()
    expect(tenant!.prompt.length).toBeGreaterThan(200)
  })

  test('instructions tell the agent to explore and find, not adjudicate', () => {
    const pack = buildReviewPack('0.1.0')
    expect(pack.instructions).toMatch(/explore|find/i)
    expect(pack.instructions).toMatch(/findings/i)
  })
})

describe('finding validation', () => {
  test('rejects a finding with no evidence', () => {
    const f = {...validFinding, evidence: []}
    expect(validateFinding(f)).toMatch(/evidence/)
  })

  test('rejects a finding missing required fields', () => {
    expect(validateFinding({...validFinding, file: ''})).toMatch(/file/)
    expect(validateFinding({...validFinding, line: undefined as never})).toMatch(/line/)
    expect(validateFinding({...validFinding, message: ''})).toMatch(/message/)
  })

  test('accepts a well-formed finding with evidence', () => {
    expect(validateFinding(validFinding)).toBeUndefined()
  })
})

describe('finding to issue', () => {
  test('marks the issue as agentic with agent provenance', () => {
    const checks = loadChecks()
    const check = checks.get('MISSING_TENANT_ISOLATION')!
    const issue = findingToIssue(
      {
        ...validFinding,
        check_version: check.version,
        prompt_hash: check.prompt_hash,
      },
      check,
    )
    expect(issue.confidence).toBe('agentic')
    expect(issue.found_by).toBe('agent')
    expect(issue.check_version).toBe(check.version)
    expect(issue.prompt_hash).toBe(check.prompt_hash)
    expect(issue.agent_confidence).toBe('high')
    expect(issue.agent_reasoning).toBe(validFinding.reasoning)
    expect(issue.fix.automated).toBe(false)
    expect(issue.evidence).toEqual([
      {
        location: {file: 'app/controllers/orders_controller.rb', line: 42},
        quote: 'Product.where(id: params[:id])',
      },
    ])
  })
})

describe('merge findings', () => {
  test('accepts findings that match a known check version', () => {
    const checks = loadChecks()
    const check = checks.get('MISSING_TENANT_ISOLATION')!
    const f = {
      ...validFinding,
      check_version: check.version,
      prompt_hash: check.prompt_hash,
    }
    const {accepted, rejected} = mergeFindings([], [f])
    expect(accepted).toBe(1)
    expect(rejected).toHaveLength(0)
  })

  test('rejects findings for an unknown check', () => {
    const f = {...validFinding, check_id: 'NONEXISTENT'}
    const {accepted, rejected} = mergeFindings([], [f])
    expect(accepted).toBe(0)
    expect(rejected[0]).toMatch(/unknown check/)
  })

  test('rejects a missing or mismatched prompt hash', () => {
    const check = loadChecks().get('MISSING_TENANT_ISOLATION')!
    expect(mergeFindings([], [{...validFinding, prompt_hash: ''}]).rejected[0]).toMatch(/prompt_hash/)
    expect(
      mergeFindings(
        [],
        [
          {
            ...validFinding,
            check_version: check.version,
            prompt_hash: 'sha256:wrong',
          },
        ],
      ).rejected[0],
    ).toMatch(/prompt_hash mismatch/)
  })

  test('rejects unsafe evidence paths and lines', () => {
    expect(
      validateFinding({
        ...validFinding,
        evidence: [{file: '../secret', line: 1}],
      }),
    ).toMatch(/unsafe evidence/)
    expect(
      validateFinding({
        ...validFinding,
        evidence: [{file: '/etc/passwd', line: 1}],
      }),
    ).toMatch(/unsafe evidence/)
    expect(
      validateFinding({
        ...validFinding,
        evidence: [{file: 'app/a.ts', line: 0}],
      }),
    ).toMatch(/evidence line/)
  })

  test('rejects findings with a version mismatch', () => {
    const checks = loadChecks()
    const check = checks.get('MISSING_TENANT_ISOLATION')!
    const f = {
      ...validFinding,
      check_version: check.version + 999,
      prompt_hash: check.prompt_hash,
    }
    const {accepted, rejected} = mergeFindings([], [f])
    expect(accepted).toBe(0)
    expect(rejected[0]).toMatch(/version mismatch/)
  })

  test('rejects findings outside the scanned input set', () => {
    const check = loadChecks().get('MISSING_TENANT_ISOLATION')!
    const finding = {
      ...validFinding,
      check_version: check.version,
      prompt_hash: check.prompt_hash,
    }
    expect(mergeFindings([], [finding], {knownFiles: new Set(['other.ts'])}).rejected[0]).toMatch(
      /not part of the scanned inputs/,
    )
    expect(
      mergeFindings([], [{...finding, evidence: [{file: 'other.ts', line: 1}]}], {knownFiles: new Set([finding.file])})
        .rejected[0],
    ).toMatch(/evidence file/)
  })

  test('rejects submissions above the finding cap', () => {
    expect(
      mergeFindings(
        [],
        Array.from({length: 1_001}, () => validFinding),
      ).rejected[0],
    ).toMatch(/exceeding the limit/)
  })

  test('rejects findings with no evidence', () => {
    const checks = loadChecks()
    const check = checks.get('MISSING_TENANT_ISOLATION')!
    const f = {
      ...validFinding,
      check_version: check.version,
      prompt_hash: check.prompt_hash,
      evidence: [],
    }
    const {accepted, rejected} = mergeFindings([], [f])
    expect(accepted).toBe(0)
    expect(rejected[0]).toMatch(/evidence/)
  })
})

describe('executed check validation', () => {
  test('records zero-finding checks and rejects duplicate or forged provenance', () => {
    const check = loadChecks().get('MISSING_TENANT_ISOLATION')!
    const valid = {
      check_id: check.id,
      check_version: check.version,
      prompt_hash: check.prompt_hash,
    }
    const other = loadChecks().get('OPEN_REDIRECT')!
    const result = validateAgentChecksExecuted({
      findings: [],
      checks_executed: [
        valid,
        valid,
        {...valid, check_id: 'UNKNOWN'},
        {
          check_id: other.id,
          check_version: other.version + 1,
          prompt_hash: other.prompt_hash,
        },
      ],
    })
    expect(result.executions).toEqual([
      expect.objectContaining({
        id: check.id,
        status: 'executed',
        findings: 0,
      }),
    ])
    expect(result.rejected.join(' ')).toMatch(/duplicate/)
    expect(result.rejected.join(' ')).toMatch(/unknown/)
    expect(result.rejected.join(' ')).toMatch(/provenance/)
  })
})
