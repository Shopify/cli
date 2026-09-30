import {loadChecks, buildAgentChecks} from '../checks/index.js'
import {EMBEDDED_CHECK_SOURCES} from '../checks/embedded.js'
import {describe, expect, test} from 'vitest'
import {readFileSync, readdirSync} from 'node:fs'

// These IDs are consumed by agent checks; changes must be intentional.
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

  test('instructions tell the agent to explore and find, not adjudicate', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    expect(agentChecks.instructions).toMatch(/explore|find/i)
  })

  test('instructions require concrete trust-boundary evidence before reporting findings', () => {
    const agentChecks = buildAgentChecks('0.1.0')
    expect(agentChecks.instructions).toContain('concrete trust-boundary violation')
    expect(agentChecks.instructions).toContain('affected authority')
    expect(agentChecks.instructions).toContain('code smell')
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
