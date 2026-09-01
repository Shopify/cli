/* eslint-disable no-restricted-imports -- deterministic scanners use real temporary repositories */
import {DETERMINISTIC_CHECKS, getRegistry} from '../index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {parseAppToml} from '../scanners/discover.js'
import {
  scanCredentialBrowserLeakage,
  scanCredentialLogLeakage,
  scanRequestControlledAdminContext,
  scanUnauthenticatedEndpoints,
  scanUnsafeInnerHTML,
} from '../rules/js-rules.js'
import {scanLiquidSecurity} from '../rules/liquid-rules.js'
import {auditKnownCves, parseAuditOutput} from '../rules/dependency-rules.js'
import {describe, expect, test} from 'vitest'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import type {ManifestFile, SourceFile} from '../rules/types.js'

const ACTIVE_IDS = [
  'MISSING_COMPLIANCE_WEBHOOKS',
  'EOL_API_VERSION',
  'EXPIRING_OFFLINE_TOKEN',
  'UNAUTHENTICATED_ENDPOINT',
  'REQUEST_CONTROLLED_ADMIN_CONTEXT',
  'DEPRECATED_SCRIPT_TAG_SCOPE',
  'INSECURE_WEBHOOK_URL',
  'COMMITTED_SECRET',
  'CREDENTIAL_LOG_LEAKAGE',
  'CREDENTIAL_BROWSER_LEAKAGE',
  'KNOWN_CVE_IN_DEPENDENCY',
  'LIQUID_UNSAFE_RENDER',
  'UNSAFE_INNERHTML',
  'APP_PROXY_LIQUID_INJECTION',
].sort()

const source = (content: string, path = 'app/routes/example.tsx'): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: path.endsWith('.liquid') ? '.liquid' : '.tsx',
  content,
})

describe('deterministic rules product contract', () => {
  test('has exactly fourteen active executable deterministic identities', () => {
    expect([...DETERMINISTIC_CHECKS.keys()].sort()).toEqual(ACTIVE_IDS)
    expect([...DETERMINISTIC_CHECKS.values()].every((check) => check.lifecycle === 'active' && check.runner)).toBe(true)
    const registry = getRegistry()
    expect(registry.some((entry) => entry.id === 'TOKEN_LEAKAGE')).toBe(false)
    expect(RULE_CATALOG.find((entry) => entry.id === 'MISSING_SRI')?.status).toBe('investigate')
    expect(RULE_CATALOG.find((entry) => entry.id === 'EXTERNAL_CDN_DEPENDENCY')?.status).toBe('investigate')
  })

  test('extracts security fields from parsed TOML without source regexes', () => {
    const parsed = parseAppToml(
      {
        access_scopes: {
          scopes: 'read_products',
          required_scopes: ['write_script_tags'],
        },
        auth: {redirect_urls: ['https://app.example/callback'], access_mode: 'offline'},
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{compliance_topics: ['shop/redact'], uri: 'pubsub://project:topic'}],
          privacy_compliance: {
            customer_deletion_url: 'https://app.example/customers/redact',
            customer_data_request_url: 'https://app.example/customers/data-request',
          },
        },
        future: {expiring_offline_access_tokens: false},
      },
      '/app/shopify.app.production.toml',
    )
    expect(parsed).toMatchObject({
      scopes: 'read_products,write_script_tags',
      apiVersion: '2023-07',
      redirectUrls: ['https://app.example/callback'],
      webhooks: [
        {topics: ['shop/redact'], uri: 'pubsub://project:topic'},
        {topics: ['customers/redact'], uri: 'https://app.example/customers/redact'},
        {topics: ['customers/data_request'], uri: 'https://app.example/customers/data-request'},
      ],
    })
  })
})

describe('JavaScript regex mode', () => {
  test('classifies React Router handlers and awaited authentication barriers', () => {
    expect(
      scanUnauthenticatedEndpoints([
        source('export async function loader({request}: LoaderArgs) { return prisma.order.findMany() }'),
      ]),
    ).toHaveLength(1)
    expect(
      scanUnauthenticatedEndpoints([
        source(
          'export async function loader({request}: LoaderArgs) { const {admin} = await authenticate.admin(request); return json({ok: true}) }',
        ),
      ]),
    ).toHaveLength(0)
    expect(
      scanUnauthenticatedEndpoints([
        source(
          'export async function loader({request}: LoaderArgs) { await authenticate.admin(request); return json({ok: true}) }',
        ),
      ]),
    ).toHaveLength(0)
    expect(
      scanUnauthenticatedEndpoints([
        source(
          'export async function loader({request}: LoaderArgs) { authenticate.admin(request); return prisma.order.findMany() }',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('detects direct admin-context and credential flows with safe exceptions', () => {
    expect(
      scanRequestControlledAdminContext([source('const shop = request.query.shop; unauthenticated.admin(shop)')]),
    ).toHaveLength(1)
    expect(scanCredentialLogLeakage([source('logger.info({ accessToken })')])).toHaveLength(1)
    expect(scanCredentialLogLeakage([source('logger.info({ hasToken: Boolean(accessToken) })')])).toHaveLength(0)
    expect(scanCredentialBrowserLeakage([source('return json({ accessToken })')])).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source('element.innerHTML = payload')])).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source('// element.innerHTML = payload\nelement.textContent = payload')])).toHaveLength(
      0,
    )
  })
})

describe('Liquid AST mode', () => {
  test('uses context-appropriate output rules and reports parser failures', () => {
    expect(
      scanLiquidSecurity([source('{{ block.settings.title }}', 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      ),
    ).toContain('LIQUID_UNSAFE_RENDER')
    expect(
      scanLiquidSecurity([source('{{ block.settings.title | escape }}', 'extensions/theme/blocks/a.liquid')]).issues,
    ).toHaveLength(0)
    expect(
      scanLiquidSecurity([
        source(
          '<script>const value = {{ product.metafields.app.value }};</script>',
          'extensions/theme/blocks/a.liquid',
        ),
      ]).issues.map((finding) => finding.id),
    ).toContain('UNSAFE_INNERHTML')
    expect(scanLiquidSecurity([source('{% if', 'extensions/theme/blocks/a.liquid')]).parserFailures).toEqual([
      'extensions/theme/blocks/a.liquid',
    ])
  })
})

describe('package-manager audit', () => {
  test('parses npm and yarn machine output', () => {
    expect(parseAuditOutput(JSON.stringify({vulnerabilities: {lodash: {severity: 'high'}}}), 'npm')).toEqual([
      {packageName: 'lodash', severity: 'high'},
    ])
    expect(parseAuditOutput('{not-json', 'npm')).toBeNull()
    expect(
      parseAuditOutput(
        `${JSON.stringify({type: 'auditAdvisory', data: {advisory: {module_name: 'x', severity: 'medium'}}})}\n${JSON.stringify({type: 'auditSummary', data: {}})}`,
        'yarn',
      ),
    ).toEqual([{packageName: 'x', severity: 'medium'}])
  })

  test('uses an injected non-mutating executor and surfaces operational failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-'))
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        dependencies: {},
      }
      const success = await auditKnownCves(directory, [manifest], async (command, args) => {
        expect(command).toBe('npm')
        expect(args.slice(0, 2)).toEqual(['audit', '--json'])
        expect(args).toContain('--ignore-scripts')
        expect(args).toContain('--registry=https://registry.npmjs.org/')
        return {stdout: JSON.stringify({vulnerabilities: {lodash: {severity: 'high'}}}), stderr: '', exitCode: 1}
      })
      expect(success.issues.map((finding) => finding.id)).toEqual(['KNOWN_CVE_IN_DEPENDENCY'])
      const failure = await auditKnownCves(directory, [manifest], async () => ({
        stdout: 'bad',
        stderr: 'network unavailable',
        exitCode: 1,
      }))
      expect(failure.unresolvedReason).toMatch(/unusable output/)
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })
})
