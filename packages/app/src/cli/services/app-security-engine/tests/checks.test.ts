import {loadChecks, buildAgentChecks, validateFinding, validateAgentChecksExecuted} from '../checks/index.js'
import {getAgentInstructions} from '../run.js'
import {EMBEDDED_CHECK_SOURCES} from '../checks/embedded.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {describe, expect, test} from 'vitest'
import {readFileSync, readdirSync} from 'node:fs'

// These IDs are consumed by agent checks and agent findings; changes must be intentional.
const EXPECTED_CHECK_IDS = [
  'ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS',
  'APP_PROXY_LIQUID_INJECTION',
  'APP_PROXY_UNVERIFIED_SIGNATURE',
  'COMMITTED_SECRET',
  'CREDENTIAL_BROWSER_LEAKAGE',
  'CREDENTIAL_LOG_LEAKAGE',
  'CROSS_SITE_SCRIPTING',
  'CSRF_MISSING_PROTECTION',
  'DEPENDENCY_REACHABILITY',
  'DEPRECATED_SCRIPT_TAG_SCOPE',
  'EOL_API_VERSION',
  'EXPIRING_OFFLINE_TOKEN',
  'INSECURE_WEBHOOK_URL',
  'LIQUID_UNSAFE_RENDER',
  'METAFIELD_OFFLINE_TOKEN',
  'MISSING_AUTHORIZATION_CHECK',
  'MISSING_COMPLIANCE_WEBHOOKS',
  'MISSING_EMBEDDED_CSP',
  'MISSING_TENANT_ISOLATION',
  'OPEN_REDIRECT',
  'OVERBROAD_DATA_ACCESS',
  'REQUEST_CONTROLLED_ADMIN_CONTEXT',
  'REQUEST_DERIVED_SHOP_SCOPE',
  'SCOPE_OVER_REQUEST',
  'SCRIPT_TAG_URL_INJECTION',
  'SESSION_LIFECYCLE_AND_REPLAY',
  'SQL_INJECTION',
  'SSRF_REQUEST_FORGERY',
  'STATIC_FRAME_ANCESTORS',
  'TEXT_SETTING_HTML_SMUGGLING',
  'THEME_EXTENSION_XSS',
  'UNAUTHENTICATED_ENDPOINT',
  'UNSAFE_INNERHTML',
  'UNSCOPED_SHOP_CONFIG_WRITE',
  'WEAK_SHOP_VALIDATION',
]

const validFinding = {
  check_id: 'MISSING_TENANT_ISOLATION',
  check_version: 1,
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

  test('loads every shipped agent check', () => {
    const checks = loadChecks()
    expect([...checks.keys()].sort()).toEqual(EXPECTED_CHECK_IDS)
  })

  test('does not carry candidate_source — the agent explores independently', () => {
    const checks = loadChecks()
    const tenant = checks.get('MISSING_TENANT_ISOLATION')!
    expect((tenant as unknown as Record<string, unknown>).candidate_source).toBeUndefined()
  })
})

describe('agent checks', () => {
  test('includes every shipped check in agent checks', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    expect(agentChecks.checks.map((check) => check.id).sort()).toEqual(EXPECTED_CHECK_IDS)
  })

  test('gives each check only its id, version, severity, docs URL, and prompt', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    const tenant = loadChecks().get('MISSING_TENANT_ISOLATION')!

    expect(Object.keys(agentChecks).sort()).toEqual([
      'checks',
      'engine',
      'generated_at',
      'instructions',
      'schema_version',
    ])
    expect(agentChecks.engine).toEqual({name: 'shopify-app-security', version: '0.1.0'})
    expect(agentChecks.checks.find((check) => check.id === tenant.id)).toEqual({
      id: tenant.id,
      version: tenant.version,
      severity: tenant.severity,
      docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/missing-tenant-isolation',
      prompt: tenant.prompt,
    })
  })

  test("gives each check its catalog entry's docs URL", () => {
    for (const check of buildAgentChecks('0.1.0').checks) {
      expect(check.docs_url, check.id).toBe(RULE_CATALOG.find((entry) => entry.id === check.id)!.docsUrl)
    }
  })

  test('instructions tell the agent to link docs_url when explaining a finding', () => {
    const {instructions} = buildAgentChecks('0.1.0')
    expect(instructions).toContain("Each check's docs_url is its\npage on shopify.dev")
  })

  test('instructions tell the agent to explore and find, not adjudicate', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    expect(agentChecks.instructions).toMatch(/explore|find/i)
    expect(agentChecks.instructions).toMatch(/findings/i)
  })

  test('instructions tell the agent to pipe one findings document to record', () => {
    const {instructions} = buildAgentChecks('0.1.0')
    expect(instructions).toContain('ONE findings document')
    expect(instructions).toContain('shopify app security record')
    // A bare `record` would write to the default configuration's results, not those of the `check` run.
    expect(instructions).toContain('using the\nexact command from the instructions you were given')
    expect(instructions).toContain('check_version')
    expect(instructions).not.toMatch(/source_scan_id|prompt_hash|inspected_files|--findings/)
  })

  test('instructions require concrete trust-boundary evidence before reporting findings', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    expect(agentChecks.instructions).toContain('concrete trust-boundary violation')
    expect(agentChecks.instructions).toContain('affected authority')
    expect(agentChecks.instructions).toContain('code smell')
  })

  test('instructions keep a check unresolved only for an incomplete investigation or a named candidate', () => {
    const {instructions} = buildAgentChecks('0.1.0')
    expect(instructions).toContain('name the candidate in the reason')
    expect(instructions).toContain('An unprovable hypothetical is not a reason to leave a check unresolved.')
    expect(getAgentInstructions()).toContain('not from whether you can prove a negative')
  })

  test('Shopify-sensitive prompts accept the React Router SDK defaults and keep the concrete failures', () => {
    const checks = loadChecks()
    const metafield = checks.get('METAFIELD_OFFLINE_TOKEN')!
    expect(metafield.version).toBe(2)
    expect(metafield.prompt).toContain('token provenance')
    expect(metafield.prompt).toContain('unauthenticated.admin(shop)')
    expect(metafield.prompt).toContain("Writing to the `$app` namespace isn't safe by itself.")

    const authorization = checks.get('MISSING_AUTHORIZATION_CHECK')!
    expect(authorization.version).toBe(3)
    expect(authorization.prompt).toContain('not a finding by itself')
    expect(authorization.prompt).toContain('sessionToken.sub')
    expect(authorization.prompt).toContain('belongs to another user of the app')
    expect(authorization.prompt).toContain('falls back to an offline session')

    const frameAncestors = checks.get('STATIC_FRAME_ANCESTORS')!
    expect(frameAncestors.version).toBe(2)
    expect(frameAncestors.prompt).toContain('addDocumentResponseHeaders')
    expect(frameAncestors.prompt).toContain('after or instead of the SDK')
    expect(frameAncestors.prompt).toContain('built from variables')
  })

  test('review prompts cover tenant provenance, authorization drift, proxy nuance, and data sensitivity', () => {
    const checks = loadChecks()
    expect(checks.get('REQUEST_DERIVED_SHOP_SCOPE')!.prompt).toContain('cache keys')
    expect(checks.get('REQUEST_DERIVED_SHOP_SCOPE')!.prompt).toContain('unbound to the current installation/session')
    expect(checks.get('MISSING_AUTHORIZATION_CHECK')!.prompt).toContain('create/read/update/delete')
    expect(checks.get('APP_PROXY_UNVERIFIED_SIGNATURE')!.prompt).toContain('victim-signed request path')
    expect(checks.get('OVERBROAD_DATA_ACCESS')!.prompt).toContain('public shop domains')
    expect(checks.get('UNSAFE_INNERHTML')!.prompt).toContain('email and PDF rendering')
    expect(checks.get('OPEN_REDIRECT')!.prompt).toContain('sensitive trust transition')
    expect(checks.get('CSRF_MISSING_PROTECTION')!.prompt).toContain('concrete sensitive action')
    expect(checks.get('MISSING_EMBEDDED_CSP')!.prompt).toContain('concrete clickjacking impact')
  })

  test('loads new lifecycle, dependency, and active-upload prompts with bounded reporting thresholds', () => {
    const checks = loadChecks()
    expect(checks.get('SESSION_LIFECYCLE_AND_REPLAY')!.prompt).toContain('stale sessions after logout or uninstall')
    expect(checks.get('DEPENDENCY_REACHABILITY')!.prompt).toContain('vulnerable API or helper')
    expect(checks.get('ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS')!.prompt).toContain(
      'untrusted-upload-to-active-render path',
    )
    expect(checks.get('ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS')!.prompt).not.toContain(
      'clearly unsafe serving configuration',
    )
  })
})

describe('finding validation', () => {
  test('rejects a finding with no evidence', () => {
    expect(validateFinding({...validFinding, evidence: []})).toMatch(/evidence/)
  })

  test('rejects a finding missing required fields', () => {
    expect(validateFinding({...validFinding, file: ''})).toMatch(/file/)
    expect(validateFinding({...validFinding, line: undefined})).toMatch(/line/)
    expect(validateFinding({...validFinding, line: 0})).toMatch(/line/)
    expect(validateFinding({...validFinding, message: ''})).toMatch(/message/)
    expect(validateFinding({...validFinding, check_version: 0})).toMatch(/check_version/)
    expect(validateFinding({...validFinding, check_version: 1.5})).toMatch(/check_version/)
  })

  test('accepts a well-formed finding with evidence and no prompt_hash', () => {
    expect(validateFinding(validFinding)).toBeUndefined()
  })

  test('accepts a suppression with a justification and rejects one without', () => {
    expect(validateFinding({...validFinding, suppression: {justification: 'Scoped by middleware'}})).toBeUndefined()
    expect(validateFinding({...validFinding, suppression: {justification: ' '}})).toMatch(/justification/)
    expect(validateFinding({...validFinding, suppression: 'accepted risk'})).toMatch(/justification/)
  })

  test.each([
    ['object file', {...validFinding, file: {path: 'app/a.ts'}}],
    ['array message', {...validFinding, message: ['not a string']}],
    ['object snippet', {...validFinding, snippet: {text: 'not a string'}}],
    ['object reasoning', {...validFinding, reasoning: {text: 'not a string'}}],
    ['unknown confidence', {...validFinding, confidence: 'certain'}],
    ['null evidence', {...validFinding, evidence: [null]}],
    ['object evidence file', {...validFinding, evidence: [{file: {path: 'app/a.ts'}}]}],
    ['string evidence line', {...validFinding, evidence: [{file: 'app/a.ts', line: '1'}]}],
    ['object evidence quote', {...validFinding, evidence: [{file: 'app/a.ts', quote: {text: 'quote'}}]}],
  ])('rejects malformed JSON field types without throwing: %s', (_name, malformed) => {
    expect(() => validateFinding(malformed)).not.toThrow()
    expect(validateFinding(malformed)).toBeDefined()
  })

  test('rejects unsafe file and evidence paths and lines', () => {
    expect(validateFinding({...validFinding, file: '/etc/passwd'})).toMatch(/unsafe file path/)
    expect(validateFinding({...validFinding, file: 'C:\\app\\a.ts'})).toMatch(/unsafe file path/)
    expect(validateFinding({...validFinding, file: 'a\0.ts'})).toMatch(/unsafe file path/)
    expect(validateFinding({...validFinding, file: `${'a/'.repeat(600)}a.ts`})).toMatch(/exceeds 1024/)
    expect(validateFinding({...validFinding, evidence: [{file: 'a\0.ts', line: 1}]})).toMatch(/unsafe evidence/)
    expect(validateFinding({...validFinding, evidence: [{file: '/etc/passwd', line: 1}]})).toMatch(/unsafe evidence/)
    expect(validateFinding({...validFinding, evidence: [{file: 'app/a.ts', line: 0}]})).toMatch(/evidence line/)
  })

  test('allows paths that start with ../, for a scan directory outside the app directory', () => {
    expect(validateFinding({...validFinding, file: '../backend/src/a.ts'})).toBeUndefined()
    expect(validateFinding({...validFinding, evidence: [{file: '../library/index.ts', line: 1}]})).toBeUndefined()
  })

  test('caps agent-supplied text and evidence', () => {
    expect(validateFinding({...validFinding, message: 'x'.repeat(4_001)})).toMatch(/message exceeds/)
    expect(validateFinding({...validFinding, file: `app/${'x'.repeat(1_024)}`})).toMatch(/file path exceeds/)
    expect(
      validateFinding({...validFinding, evidence: Array.from({length: 51}, () => ({file: 'app/a.ts', line: 1}))}),
    ).toMatch(/evidence citations/)
  })
})

describe('executed check validation', () => {
  const tenant = loadChecks().get('MISSING_TENANT_ISOLATION')!

  test('records zero-finding checks and rejects duplicate and unknown entries', () => {
    const valid = {check_id: tenant.id, check_version: tenant.version, status: 'executed'}
    const result = validateAgentChecksExecuted([valid, valid, {...valid, check_id: 'UNKNOWN'}], [])

    expect(result.reports).toEqual([{check_id: tenant.id, check_version: tenant.version, status: 'executed'}])
    expect(result.errors).toEqual([
      `checks_executed[1] (${tenant.id}): duplicate check_id in checks_executed`,
      'checks_executed[2] (UNKNOWN): unknown check_id',
    ])
  })

  test('keeps the claimed check_version without comparing it with the catalog', () => {
    const result = validateAgentChecksExecuted([{check_id: tenant.id, check_version: tenant.version + 7}], [])

    expect(result.errors).toEqual([])
    expect(result.reports).toEqual([{check_id: tenant.id, check_version: tenant.version + 7, status: 'executed'}])
  })

  test('requires a reason for unresolved and not_applicable checks, but no guidance', () => {
    const reason = {code: 'no_relevant_files', message: 'No data access layer'}
    const result = validateAgentChecksExecuted(
      [
        {check_id: tenant.id, check_version: 1, status: 'unresolved'},
        {check_id: 'OPEN_REDIRECT', check_version: 1, status: 'not_applicable'},
        {check_id: 'CSRF_MISSING_PROTECTION', check_version: 1, status: 'not_applicable', reason},
        {check_id: 'SSRF_REQUEST_FORGERY', check_version: 1, status: 'passed'},
        {check_id: 'UNSAFE_INNERHTML', check_version: 1, status: 'unresolved', reason: {code: 'x'}},
      ],
      [],
    )

    expect(result.reports).toEqual([
      {check_id: 'CSRF_MISSING_PROTECTION', check_version: 1, status: 'not_applicable', reason},
    ])
    expect(result.errors).toEqual([
      `checks_executed[0] (${tenant.id}): unresolved requires a reason`,
      'checks_executed[1] (OPEN_REDIRECT): not_applicable requires a reason',
      'checks_executed[3] (SSRF_REQUEST_FORGERY): status must be executed, not_applicable, or unresolved',
      'checks_executed[4] (UNSAFE_INNERHTML): reason requires a code and message',
    ])
  })

  test('rejects a not_applicable check that has findings', () => {
    const result = validateAgentChecksExecuted(
      [{check_id: tenant.id, check_version: 1, status: 'not_applicable', reason: {code: 'n/a', message: 'None'}}],
      [validFinding],
    )

    expect(result.reports).toEqual([])
    expect(result.errors).toEqual([`checks_executed[0] (${tenant.id}): a not_applicable check can't have findings`])
  })
})
