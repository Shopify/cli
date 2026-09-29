import {loadChecks} from '../checks/index.js'
import {assertRegistryInvariants, getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS, DETERMINISTIC_RULES} from '../scanners/index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {describe, expect, test} from 'vitest'
import type {CheckPrecedence} from '../types.js'

const PREFER_AGENT_CHECK_IDS = [
  'APP_PROXY_LIQUID_INJECTION',
  'CREDENTIAL_BROWSER_LEAKAGE',
  'CREDENTIAL_LOG_LEAKAGE',
  'DEPRECATED_SCRIPT_TAG_SCOPE',
  'EOL_API_VERSION',
  'EXPIRING_OFFLINE_TOKEN',
  'INSECURE_WEBHOOK_URL',
  'MISSING_COMPLIANCE_WEBHOOKS',
  'REQUEST_CONTROLLED_ADMIN_CONTEXT',
  'STATIC_FRAME_ANCESTORS',
]

const EXPLICIT_UNION_CHECK_IDS = [
  'COMMITTED_SECRET',
  'LIQUID_UNSAFE_RENDER',
  'UNAUTHENTICATED_ENDPOINT',
  'UNSAFE_INNERHTML',
]

const checkSource = (id: string, precedence?: string): string =>
  `---\nid: ${id}\nversion: 1\nseverity: high\n${precedence === undefined ? '' : `precedence: ${precedence}\n`}---\n\n# ${id}\n\nPrompt body.\n`

describe('authoritative registry', () => {
  test('contains every executable deterministic rule and shipped agent check exactly once', () => {
    const registry = getRegistry()
    expect(
      registry
        .filter((entry) => entry.kind === 'deterministic')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(DETERMINISTIC_RULES.map((entry) => entry.id).sort())
    expect(
      registry
        .filter((entry) => entry.kind === 'agent')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([...loadChecks().keys()].sort())
    expect(new Set(registry.map((entry) => `${entry.kind}:${entry.id}`)).size).toBe(registry.length)
  })

  test('has catalog documentation for every deterministic rule', () => {
    const catalogIds = new Set(RULE_CATALOG.map((entry) => entry.id))
    expect(DETERMINISTIC_RULES.filter((entry) => !catalogIds.has(entry.id))).toEqual([])
  })
})

describe('check precedence', () => {
  test('sets the expected precedence on the 14 shared checks and defaults every other check to union', () => {
    const checks = loadChecks()
    const precedenceById = new Map<string, CheckPrecedence>()
    for (const check of checks.values()) precedenceById.set(check.id, check.precedence)

    const expected = new Map<string, CheckPrecedence>([
      ...PREFER_AGENT_CHECK_IDS.map((id): [string, CheckPrecedence] => [id, 'prefer-agent']),
      ...EXPLICIT_UNION_CHECK_IDS.map((id): [string, CheckPrecedence] => [id, 'union']),
    ])
    expect(expected.size).toBe(14)
    for (const [id, precedence] of expected) expect(precedenceById.get(id), id).toBe(precedence)

    const others = [...checks.values()].filter((check) => !expected.has(check.id))
    expect(others.filter((check) => check.precedence !== 'union').map((check) => check.id)).toEqual([])
  })

  test('every shared check has a deterministic implementation to prefer over or unite with', () => {
    const sharedIds = [...PREFER_AGENT_CHECK_IDS, ...EXPLICIT_UNION_CHECK_IDS]
    expect(sharedIds.filter((id) => !DETERMINISTIC_CHECKS.has(id))).toEqual([])
  })

  test('defaults precedence to union when the frontmatter omits the key', () => {
    const checks = loadChecks([checkSource('ONLY_AGENT')])
    expect(checks.get('ONLY_AGENT')!.precedence).toBe('union')
  })

  test('reads an explicit precedence and rejects an invalid value at load time', () => {
    expect(loadChecks([checkSource('SHARED', 'prefer-agent')]).get('SHARED')!.precedence).toBe('prefer-agent')
    expect(loadChecks([checkSource('SHARED', 'union')]).get('SHARED')!.precedence).toBe('union')
    expect(() => loadChecks([checkSource('SHARED', 'prefer-deterministic')])).toThrow(
      'Invalid precedence for agent check SHARED: prefer-deterministic (expected union or prefer-agent)',
    )
  })

  test('rejects a prefer-agent check that has no deterministic implementation', () => {
    const shared = DETERMINISTIC_CHECKS.get('UNSAFE_INNERHTML')!
    const catalog = RULE_CATALOG.filter((entry) => entry.id === shared.id)
    const agent = {id: shared.id, version: shared.version, prompt_hash: `sha256:${'a'.repeat(64)}`}

    expect(() =>
      assertRegistryInvariants({catalog, deterministic: [shared], agent: [{...agent, precedence: 'prefer-agent'}]}),
    ).not.toThrow()
    expect(() =>
      assertRegistryInvariants({catalog, deterministic: [], agent: [{...agent, precedence: 'union'}]}),
    ).not.toThrow()
    expect(() =>
      assertRegistryInvariants({catalog, deterministic: [], agent: [{...agent, precedence: 'prefer-agent'}]}),
    ).toThrow('prefer-agent check has no deterministic implementation: UNSAFE_INNERHTML')
  })
})
