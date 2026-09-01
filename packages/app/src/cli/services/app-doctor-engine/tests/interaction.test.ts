import {formatConsole} from '../output/format.js'
import {getRegistry} from '../registry/index.js'
import {describe, expect, test} from 'vitest'
import type {ScanResult} from '../types.js'

const result: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
  app: {name: 'Example App', type: 'public'},
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/routes/action.ts']}],
  },
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: true,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  score: {total: 40, baseline: 100, grade: 'POOR'},
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    doctor_version: '0.1.0',
    files_scanned: 12,
    rules_run: 18,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_complete: true,
    coverage_gaps: [],
    input_hash: 'sha256:input',
    result_hash: 'sha256:result',
    checks_executed: [],
  },
  issues: [
    {
      id: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
      severity: 'high',
      points: -30,
      title: 'Request input selects Admin API shop context',
      message: 'A request-controlled shop value is passed to unauthenticated.admin(...).',
      location: {file: 'app/routes/action.ts', line: 42},
      fix: {
        automated: false,
        description: 'Use authenticate.admin(request).',
      },
    },
    {
      id: 'EOL_API_VERSION',
      severity: 'high',
      points: -10,
      title: 'Configured API version is no longer supported',
      message: 'The configured API version is outside the supported window.',
      location: {file: 'shopify.app.toml'},
      fix: {automated: false, description: 'Upgrade to a supported API version.'},
    },
  ],
}

describe('React Doctor-style interaction surface', () => {
  test('renders a concise grouped report by default', () => {
    const output = formatConsole(result, {elapsedMilliseconds: 125})

    expect(output).toContain('12 files scanned in 125ms')
    expect(output).toContain('Shopify App Doctor — Example App')
    expect(output).toContain('2 issues')
    expect(output).toContain('High: 2')
    expect(output).toContain('REQUEST_CONTROLLED_ADMIN_CONTEXT')
    expect(output).not.toContain('Fix: Use authenticate.admin(request).')
  })

  test('adds evidence and fix guidance in verbose mode', () => {
    const output = formatConsole(result, {verbose: true})

    expect(output).toContain('Fix: Use authenticate.admin(request).')
    expect(output).toContain('Capabilities: has_backend')
    expect(output).toContain('Rules run: 18 | Not run: 0')
  })

  test('exposes the authoritative registry for list and explain commands', () => {
    const registry = getRegistry()
    expect(registry.length).toBeGreaterThanOrEqual(31)
    expect(registry.some((entry) => entry.id === 'TOKEN_LEAKAGE')).toBe(false)
    expect(registry.find((entry) => entry.id === 'CREDENTIAL_LOG_LEAKAGE')?.title).toBe('Credential reaches a log sink')
  })
})
