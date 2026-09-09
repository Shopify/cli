/* eslint-disable no-restricted-imports -- deterministic scanners use real temporary repositories */
import {getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS} from '../scanners/index.js'
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
import {scanStaticFrameAncestors} from '../rules/csp-rules.js'
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
  'STATIC_FRAME_ANCESTORS',
].sort()

const source = (content: string, path = 'app/routes/example.tsx'): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: path.endsWith('.liquid') ? '.liquid' : '.tsx',
  content,
})

describe('deterministic rules product contract', () => {
  test('has exactly fifteen active executable deterministic identities', () => {
    expect([...DETERMINISTIC_CHECKS.keys()].sort()).toEqual(ACTIVE_IDS)
    expect([...DETERMINISTIC_CHECKS.values()].every((check) => check.lifecycle === 'active' && check.runner)).toBe(true)
    const registry = getRegistry()
    expect(registry.some((entry) => entry.id === 'TOKEN_LEAKAGE')).toBe(false)
    expect(RULE_CATALOG.find((entry) => entry.id === 'MISSING_SRI')?.status).toBe('investigate')
    expect(RULE_CATALOG.find((entry) => entry.id === 'EXTERNAL_CDN_DEPENDENCY')?.status).toBe('investigate')
  })

  test('bumps deterministic versions when scanner behavior changes', () => {
    expect(DETERMINISTIC_CHECKS.get('REQUEST_CONTROLLED_ADMIN_CONTEXT')?.version).toBe(3)
    expect(DETERMINISTIC_CHECKS.get('APP_PROXY_LIQUID_INJECTION')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('INSECURE_WEBHOOK_URL')?.version).toBe(2)
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

  test('keeps valid sections when another configuration section is invalid', () => {
    const parsed = parseAppToml(
      {
        access_scopes: {scopes: 'read_products'},
        auth: {redirect_urls: ['https://app.example/callback']},
        webhooks: 'not-a-section',
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.scopes).toBe('read_products')
    expect(parsed.redirectUrls).toEqual(['https://app.example/callback'])
    expect(parsed.webhooks).toEqual([])
    expect(parsed.apiVersion).toBeUndefined()
  })

  test('keeps insecure webhook URIs that the CLI URI validator rejects', () => {
    const parsed = parseAppToml(
      {
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{topics: ['orders/create'], uri: 'http://insecure.example/webhooks'}],
        },
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.webhooks).toEqual([{topics: ['orders/create'], uri: 'http://insecure.example/webhooks'}])
  })

  test('drops webhook subscriptions that are not CLI-shaped', () => {
    const parsed = parseAppToml(
      {
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{not: 'a-subscription'}, {topics: ['orders/create']}],
        },
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.webhooks).toEqual([])
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

describe('STATIC_FRAME_ANCESTORS regex mode', () => {
  test('flags only literal clearly permissive frame-ancestors source tokens', () => {
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors *"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors https://*"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors *.myshopify.com"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.myshopify.com"}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors https:"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors 'self' https:"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://admin.shopify.com https://merchant.myshopify.com"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.myshopify.com.evil.test"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.mycompany.dev"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
  })

  test('evaluates only static CSP header values and ignores commented examples', () => {
    expect(
      scanStaticFrameAncestors([
        source(`headers.set('Content-Security-Policy', policy); const example = 'frame-ancestors *'`, 'app/root.tsx'),
      ]),
    ).toEqual([])
    expect(scanStaticFrameAncestors([source(`const note = 'frame-ancestors *'`, 'app/root.tsx')])).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(`const safe = true;// const headers = {'Content-Security-Policy': 'frame-ancestors *'}`, 'app/root.tsx'),
      ]),
    ).toEqual([])
  })

  test('covers static header setters, concatenation, templates, and mixed source lists', () => {
    expect(
      scanStaticFrameAncestors([
        source(`headers.set('Content-Security-Policy', 'frame-ancestors *')`, 'app/root.tsx'),
        source(`response.headers.append('Content-Security-Policy', 'frame-ancestors *')`, 'app/response.tsx'),
        source(`res.setHeader('Content-Security-Policy', 'frame-ancestors *')`, 'app/server.tsx'),
      ]),
    ).toHaveLength(3)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': 'frame-ancestors ' + '*'}`, 'app/root.tsx'),
        source(`const headers = {'Content-Security-Policy': \`frame-ancestors *\`}`, 'app/template.tsx'),
        source(`const headers = {'Content-Security-Policy': "frame-ancestors 'self' *"}`, 'app/mixed.tsx'),
      ]),
    ).toHaveLength(3)
  })

  test('handles multiline and long static CSP literal construction', () => {
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {
  'Content-Security-Policy': [
    "default-src 'self';",
    'frame-ancestors *',
  ].join(' '),
}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "default-src ${'https://cdn.example.com '.repeat(40)}; frame-ancestors *"}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('consumes malformed string literals once', () => {
    const malformed = `const broken = "${'\\"'.repeat(64_000)}`

    expect(scanStaticFrameAncestors([source(malformed, 'app/broken.tsx')])).toEqual([])
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
      {packageName: 'lodash', severity: 'high', cves: [], topLevelParents: []},
    ])
    expect(parseAuditOutput('{not-json', 'npm')).toBeNull()
    expect(
      parseAuditOutput(
        `${JSON.stringify({type: 'auditAdvisory', data: {advisory: {module_name: 'x', severity: 'medium'}}})}\n${JSON.stringify({type: 'auditSummary', data: {}})}`,
        'yarn',
      ),
    ).toEqual([{packageName: 'x', severity: 'medium', cves: [], topLevelParents: []}])
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
      const success = await auditKnownCves(directory, [manifest], async (command, args, options) => {
        expect(command).toBe('npm')
        expect(args.slice(0, 2)).toEqual(['audit', '--json'])
        expect(args).toContain('--omit=dev')
        expect(args).toContain('--ignore-scripts')
        expect(args).toContain('--registry=https://registry.npmjs.org/')
        expect(options.env.NPM_CONFIG_USERCONFIG).toBeTruthy()
        expect(options.env.NPM_CONFIG_GLOBALCONFIG).toBeTruthy()
        expect(options.env.NPM_CONFIG_USERCONFIG).not.toBe(options.env.NPM_CONFIG_GLOBALCONFIG)
        return {stdout: JSON.stringify({vulnerabilities: {lodash: {severity: 'high'}}}), stderr: '', exitCode: 1}
      })
      expect(success.issues.map((finding) => finding.id)).toEqual(['KNOWN_CVE_IN_DEPENDENCY'])
      expect(success.issues[0]?.title).toBe('lodash has a high vulnerability')
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
