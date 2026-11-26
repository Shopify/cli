/* eslint-disable no-restricted-imports -- detector coverage uses real temporary repositories */
import {scanDirectory as scan} from './scan-directory.js'
import {buildAgentChecks} from '../checks/index.js'
import {assertRegistryInvariants, getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS} from '../scanners/index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function app(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'app-security-scan-contract-'))
  directories.push(directory)
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(directory, path)
      await mkdir(join(fullPath, '..'), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
  return directory
}

const appConfig = (scopes = '') => `name = "Scan contract"\n[access_scopes]\nscopes = "${scopes}"\n`
const reactPackage = JSON.stringify({dependencies: {'@shopify/shopify-app-react-router': '^1.0.0'}})

describe('framework and surface detection', () => {
  test('detects React Router only when package and structure agree', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export const shopify = {}',
      'app/routes/index.tsx': 'export const loader = () => null',
    })
    const result = await scan(directory)

    expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
  })

  test('detects config-only, theme extension, mixed, and unknown surfaces', async () => {
    const configOnly = await scan(await app({'shopify.app.toml': appConfig()}))
    expect(configOnly.detection).toMatchObject({framework: 'none', surface: 'config_only'})
    expect(configOnly.scan.coverage_gaps).toEqual([])

    const theme = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'extensions/theme/shopify.extension.toml': 'type = "theme"\n',
        'extensions/theme/blocks/app.liquid': '{{ product.title }}',
      }),
    )
    expect(theme.detection).toMatchObject({framework: 'none', surface: 'theme_app_extension'})

    const mixed = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.tsx': 'export const loader = () => null',
        'extensions/theme/shopify.extension.toml': 'type = "theme"\n',
        'extensions/theme/blocks/app.liquid': '{{ product.title }}',
      }),
    )
    expect(mixed.detection).toMatchObject({framework: 'react_router', surface: 'mixed'})

    const unknown = await scan(await app({'shopify.app.toml': appConfig(), 'server.ts': 'export const server = {}'}))
    expect(unknown.detection).toMatchObject({framework: 'unknown', surface: 'unknown'})
    expect(unknown.scan.coverage_gaps).not.toEqual([])
    expect(
      unknown.scan.checks_executed.find((execution) => execution.id === 'MISSING_COMPLIANCE_WEBHOOKS'),
    ).toMatchObject({status: 'executed'})
    expect(unknown.issues.some((issue) => issue.id === 'MISSING_COMPLIANCE_WEBHOOKS')).toBe(true)
    expect(unknown.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')?.status).toBe(
      'unsupported_framework',
    )
  })

  test('owns expiring-token applicability and unresolved handoff at runtime', async () => {
    const configOnly = await scan(await app({'shopify.app.toml': appConfig()}))
    expect(
      configOnly.scan.checks_executed.find((execution) => execution.id === 'EXPIRING_OFFLINE_TOKEN'),
    ).toMatchObject({status: 'not_applicable', applicable: false})

    const ambiguous = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export default shopifyApp({isOnline: false, sessionStorage})',
        'app/routes/index.tsx': 'export const loader = () => null',
      }),
    )
    expect(ambiguous.scan.checks_executed.find((execution) => execution.id === 'EXPIRING_OFFLINE_TOKEN')).toMatchObject(
      {
        status: 'unresolved',
        reason: {code: 'parser_unavailable'},
      },
    )

    const compatible = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': reactPackage,
        'app/shopify.server.ts':
          'export default shopifyApp({future: {expiringOfflineAccessTokens: true}, isOnline: false, sessionStorage: new MemorySessionStorage()})',
        'app/routes/index.tsx': 'export const loader = () => null',
      }),
    )
    expect(
      compatible.scan.checks_executed.find((execution) => execution.id === 'EXPIRING_OFFLINE_TOKEN'),
    ).toMatchObject({status: 'executed', findings: 0})
  })

  test('runs static frame-ancestors only for embedded admin apps', async () => {
    const embedded = await scan(
      await app({
        'shopify.app.toml': `name = "Embedded app"\nembedded = true\n[access_scopes]\nscopes = ""\n`,
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.tsx': `export const loader = () => null; const headers = {'Content-Security-Policy': 'frame-ancestors *'}`,
      }),
    )
    expect(embedded.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS')).toMatchObject({
      status: 'executed',
      findings: 1,
    })

    const plain = await scan(
      await app({
        'shopify.app.toml': `name = "Plain app"\nembedded = false\n[access_scopes]\nscopes = ""\n`,
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.tsx': `export const loader = () => null; const headers = {'Content-Security-Policy': 'frame-ancestors *'}`,
      }),
    )
    expect(plain.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS')).toMatchObject({
      status: 'not_applicable',
      applicable: false,
    })
    expect(plain.issues.some((issue) => issue.id === 'STATIC_FRAME_ANCESTORS')).toBe(false)

    const themeOnly = await scan(
      await app({
        'shopify.app.toml': `name = "Theme app"\nembedded = false\n[access_scopes]\nscopes = ""\n`,
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.tsx': `export const loader = () => null; const headers = {'Content-Security-Policy': 'frame-ancestors *'}`,
        'extensions/theme/shopify.extension.toml': 'type = "theme"\n',
        'extensions/theme/blocks/app.liquid': `{% schema %}{"target":"body"}{% endschema %}`,
      }),
    )
    expect(themeOnly.capabilities.app_embed).toBe(true)
    expect(themeOnly.capabilities.embedded_app).toBe(false)
    expect(themeOnly.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS')).toMatchObject(
      {
        status: 'not_applicable',
        applicable: false,
      },
    )
  })

  test('runs static frame-ancestors for embedded non-React-Router JavaScript apps', async () => {
    const result = await scan(
      await app({
        'shopify.app.toml': `name = "Embedded generic app"\nembedded = true\n[access_scopes]\nscopes = ""\n`,
        'server.ts': `const headers = {'Content-Security-Policy': 'frame-ancestors *'}`,
      }),
    )

    expect(result.detection.framework).toBe('unknown')
    expect(result.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS')).toMatchObject({
      status: 'executed',
      findings: 1,
      inspected_files: ['server.ts'],
    })
  })

  test('scopes embedded-app capability to the selected app configuration', async () => {
    const directory = await app({
      'shopify.app.toml': `name = "Embedded production"\nembedded = true\n[access_scopes]\nscopes = ""\n`,
      'shopify.app.staging.toml': `name = "Non-embedded staging"\nembedded = false\n[access_scopes]\nscopes = ""\n`,
      'server.ts': `const headers = {'Content-Security-Policy': 'frame-ancestors *'}`,
    })

    const defaultScan = await scan(directory)
    expect(defaultScan.capabilities.embedded_app).toBe(true)
    expect(defaultScan.app.name).toBe('Embedded production')
    expect(
      defaultScan.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS'),
    ).toMatchObject({
      status: 'executed',
      findings: 1,
    })

    const staging = await scan(directory, 'staging')
    expect(staging.capabilities.embedded_app).toBe(false)
    expect(staging.app.name).toBe('Non-embedded staging')
    expect(staging.scan.checks_executed.find((execution) => execution.id === 'STATIC_FRAME_ANCESTORS')).toMatchObject({
      status: 'not_applicable',
    })
  })

  test('does not report findings or inspect a sibling app configuration', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'shopify.app.production.toml': appConfig('write_script_tags'),
    })

    const result = await scan(directory, 'shopify.app.toml')
    const deprecated = result.scan.checks_executed.find((execution) => execution.id === 'DEPRECATED_SCRIPT_TAG_SCOPE')

    expect(deprecated).toMatchObject({status: 'executed', findings: 0, inspected_files: ['shopify.app.toml']})
    expect(result.issues.filter((issue) => issue.id === 'DEPRECATED_SCRIPT_TAG_SCOPE')).toEqual([])
    expect(result.scan.checks_executed.flatMap((execution) => execution.inspected_files)).not.toContain(
      'shopify.app.production.toml',
    )
  })

  test('keeps React Router and theme implementations inside their supported file boundaries', async () => {
    const themeDirectory = await app({
      'shopify.app.toml': appConfig(),
      'extensions/theme/shopify.extension.toml': 'type = "theme"\n',
      'extensions/theme/assets/widget.mjs': 'element.innerHTML = payload',
      'extensions/theme/blocks/app.liquid': '<script>const value = {{ product.metafields.app.value }};</script>',
    })
    const theme = await scan(themeDirectory)
    const themeRequestCheck = theme.scan.checks_executed.find(
      (execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
    )!
    const themeUnsafe = theme.scan.checks_executed.find((execution) => execution.id === 'UNSAFE_INNERHTML')!
    expect(themeRequestCheck.status).toBe('not_applicable')
    expect(themeRequestCheck.inspected_files).toEqual([])
    expect(themeUnsafe.status).toBe('executed')
    expect(themeUnsafe.inspected_files).toEqual([
      'extensions/theme/assets/widget.mjs',
      'extensions/theme/blocks/app.liquid',
    ])

    const mixed = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': reactPackage,
        'app/shopify.server.mts': 'export const shopify = {}',
        'app/routes/index.mts': 'export const loader = () => null; element.innerHTML = payload',
        'extensions/theme/shopify.extension.toml': 'type = "theme"\n',
        'extensions/theme/assets/widget.cjs': 'element.innerHTML = payload',
        'extensions/theme/blocks/app.liquid': '{{ product.title }}',
      }),
    )
    const mixedRequestCheck = mixed.scan.checks_executed.find(
      (execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
    )!
    const mixedUnsafe = mixed.scan.checks_executed.find((execution) => execution.id === 'UNSAFE_INNERHTML')!
    expect(mixed.detection).toMatchObject({framework: 'react_router', surface: 'mixed'})
    expect(mixedRequestCheck.inspected_files).not.toContain('extensions/theme/assets/widget.cjs')
    expect(mixedUnsafe.inspected_files).toEqual([
      'app/routes/index.mts',
      'app/shopify.server.mts',
      'extensions/theme/assets/widget.cjs',
      'extensions/theme/blocks/app.liquid',
    ])
    expect(mixed.issues.filter((issue) => issue.id === 'UNSAFE_INNERHTML')).toHaveLength(2)
  })

  test('requires the Shopify React Router package and reports unsupported app languages', async () => {
    const genericReactRouter = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': JSON.stringify({dependencies: {'react-router': '^7.0.0'}}),
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.ts': 'export const loader = () => null',
      }),
    )
    expect(genericReactRouter.detection.framework).toBe('unknown')
    expect(
      genericReactRouter.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')?.status,
    ).toBe('unsupported_framework')

    const unsupportedStatuses = await Promise.all(
      ['rb', 'php', 'py', 'go'].map(async (extension) => {
        const unsupported = await scan(
          await app({'shopify.app.toml': appConfig(), [`app/server.${extension}`]: 'def route; end'}),
        )
        return unsupported.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')?.status
      }),
    )
    expect(unsupportedStatuses).toEqual(Array.from({length: 4}, () => 'unsupported_framework'))
  })

  test('gives an Express app deterministic findings from framework-agnostic rules', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': JSON.stringify({dependencies: {express: '^4.19.2', '@shopify/shopify-api': '^11.0.0'}}),
      'server.js': `import express from 'express'

const app = express()

app.get('/auth', async (req, res) => {
  const shop = req.query.shop
  if (!/myshopify\\.com/.test(shop)) return res.status(400).send('Invalid shop')
  console.log('Installed', session.accessToken)
  return res.json({shop})
})
`,
    })

    const result = await scan(directory)

    expect(result.detection).toMatchObject({framework: 'unknown', surface: 'unknown'})
    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['CREDENTIAL_LOG_LEAKAGE', 'WEAK_SHOP_VALIDATION']),
    )
    expect(result.scan.checks_executed.find((execution) => execution.id === 'CREDENTIAL_LOG_LEAKAGE')).toMatchObject({
      status: 'executed',
      findings: 1,
    })
    expect(result.scan.checks_executed.find((execution) => execution.id === 'WEAK_SHOP_VALIDATION')).toMatchObject({
      status: 'executed',
      findings: 1,
    })
    // Checks that read React Router's route semantics stay gated to React Router apps.
    expect(result.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')?.status).toBe(
      'unsupported_framework',
    )
  })

  test('accepts an anchored shop-domain check in an app without React Router', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': JSON.stringify({dependencies: {express: '^4.19.2'}}),
      'server.js': `import express from 'express'

const app = express()

app.get('/auth', (req, res) => {
  const shop = req.query.shop
  if (!/^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$/.test(shop)) return res.status(400).send('Invalid shop')
  return res.json({shop})
})
`,
    })

    const result = await scan(directory)

    expect(result.scan.checks_executed.find((execution) => execution.id === 'WEAK_SHOP_VALIDATION')).toMatchObject({
      status: 'executed',
      findings: 0,
    })
    expect(result.issues.filter((issue) => issue.id === 'WEAK_SHOP_VALIDATION')).toEqual([])
  })

  test('keeps widened rules unresolved when the app source language is unsupported', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'app/controllers/x_controller.rb': `class X
  def index
    Rails.logger.info(session[:access_token])
  end
end
`,
    })

    const result = await scan(directory)

    expect(result.detection).toMatchObject({framework: 'unknown', surface: 'unknown'})
    for (const id of [
      'CREDENTIAL_LOG_LEAKAGE',
      'REQUEST_CONTROLLED_ADMIN_CONTEXT',
      'UNSAFE_INNERHTML',
      'WEAK_SHOP_VALIDATION',
    ]) {
      expect(
        result.scan.checks_executed.find((execution) => execution.id === id),
        id,
      ).toMatchObject({
        status: 'unresolved',
        applicable: true,
        reason: {code: 'unsupported_language', message: expect.stringContaining('ruby')},
      })
    }
    expect(result.scan.coverage_gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'WEAK_SHOP_VALIDATION'}),
    )
    expect(result.scan.coverage_gaps).toContainEqual(expect.objectContaining({code: 'unsupported_language'}))
    expect(
      result.scan.checks_executed.find((execution) => execution.id === 'APP_PROXY_LIQUID_INJECTION'),
    ).toMatchObject({status: 'not_applicable', reason: {code: 'capability_absent'}})

    const configOnly = await scan(await app({'shopify.app.toml': appConfig()}))
    expect(configOnly.scan.checks_executed.find((execution) => execution.id === 'WEAK_SHOP_VALIDATION')).toMatchObject({
      status: 'not_applicable',
      reason: {code: 'no_relevant_files'},
    })
  })

  test('keeps widened rules unresolved when unsupported app source sits beside supported files they do not read', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'app/controllers/x_controller.rb': 'class X\nend\n',
      'public/404.html': '<html><body>The page you were looking for does not exist.</body></html>\n',
    })

    const result = await scan(directory)

    for (const id of [
      'CREDENTIAL_LOG_LEAKAGE',
      'DEPRECATED_SCRIPT_TAG_SCOPE',
      'REQUEST_CONTROLLED_ADMIN_CONTEXT',
      'UNSAFE_INNERHTML',
      'WEAK_SHOP_VALIDATION',
    ]) {
      expect(
        result.scan.checks_executed.find((execution) => execution.id === id),
        id,
      ).toMatchObject({
        status: 'unresolved',
        applicable: true,
        reason: {code: 'unsupported_language', message: expect.stringMatching(/: ruby\.$/)},
      })
    }
  })

  test('keeps a React Router template free of findings from the widened rules', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export default shopifyApp({})',
      'app/routes/app._index.tsx': `export const loader = async ({request}) => {
  const {session} = await authenticate.admin(request)
  return {shop: session.shop}
}
`,
    })

    const result = await scan(directory)

    expect(result.detection.framework).toBe('react_router')
    expect(
      result.issues.filter((issue) => issue.id === 'CREDENTIAL_LOG_LEAKAGE' || issue.id === 'WEAK_SHOP_VALIDATION'),
    ).toEqual([])
    expect(result.scan.checks_executed.find((execution) => execution.id === 'CREDENTIAL_LOG_LEAKAGE')).toMatchObject({
      status: 'executed',
      findings: 0,
    })
    expect(result.scan.checks_executed.find((execution) => execution.id === 'WEAK_SHOP_VALIDATION')).toMatchObject({
      status: 'executed',
      findings: 0,
    })
    expect(result.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')?.status).toBe(
      'executed',
    )
  })

  test('detects server template formats as source languages', async () => {
    const templateFiles = [
      'views/index.ejs',
      'views/index.erb',
      'views/index.hbs',
      'views/index.jinja2',
      'views/index.twig',
    ]
    const result = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        ...Object.fromEntries(templateFiles.map((path) => [path, '<p>{{ user_input }}</p>'])),
      }),
    )

    expect(result.detection.languages.flatMap((language) => language.files)).toEqual(
      expect.arrayContaining(templateFiles),
    )
  })

  test('makes only affected checks unresolved when readable and rejected inputs coexist', async () => {
    const malformedSelected = await scan(await app({'shopify.app.toml': 'name = ['}))
    expect(
      malformedSelected.scan.checks_executed.find((execution) => execution.id === 'EOL_API_VERSION'),
    ).toMatchObject({
      status: 'unresolved',
      reason: {code: 'parser_unavailable'},
    })

    const malformedSibling = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'shopify.app.invalid.toml': 'name = [',
      }),
    )
    expect(
      malformedSibling.scan.checks_executed.find((execution) => execution.id === 'EOL_API_VERSION')?.status,
    ).not.toBe('unresolved')

    const skippedSource = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'package.json': reactPackage,
        'app/shopify.server.ts': 'export const shopify = {}',
        'app/routes/index.ts': 'export const loader = () => null',
        'app/routes/skipped.ts': 'x'.repeat(500_001),
      }),
    )
    expect(
      skippedSource.scan.checks_executed.find((execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT'),
    ).toMatchObject({
      status: 'unresolved',
      reason: {code: 'input_rejected'},
      inspected_files: expect.arrayContaining(['app/routes/index.ts']),
    })
  })

  test('recognizes managed scopes and legacy privacy compliance webhook configuration', async () => {
    const directory = await app({
      'shopify.app.toml': `name = "Managed config"
[access_scopes]
required_scopes = ["write_script_tags"]
[webhooks]
api_version = "2026-07"
[webhooks.privacy_compliance]
customer_deletion_url = "https://app.example/customers/redact"
customer_data_request_url = "https://app.example/customers/data-request"
shop_deletion_url = "http://app.example/shop/redact"
`,
    })
    const result = await scan(directory)
    const issueIds = result.issues.map((issue) => issue.id)

    expect(issueIds).toContain('DEPRECATED_SCRIPT_TAG_SCOPE')
    expect(issueIds).toContain('INSECURE_WEBHOOK_URL')
    expect(issueIds).not.toContain('MISSING_COMPLIANCE_WEBHOOKS')
  })

  test('reports unsafe OAuth redirect URLs without a webhook capability gate', async () => {
    const result = await scan(
      await app({
        'shopify.app.toml': `name = "Redirect config"
[auth]
redirect_urls = ["http://app.example/callback"]
`,
      }),
    )
    const execution = result.scan.checks_executed.find((check) => check.id === 'INSECURE_WEBHOOK_URL')
    const issue = result.issues.find((finding) => finding.id === 'INSECURE_WEBHOOK_URL')

    expect(execution).toMatchObject({status: 'executed', applicable: true})
    expect(issue).toMatchObject({
      title: 'Configured callback URL is not HTTPS',
      message: expect.stringContaining('OAuth redirect URI'),
    })
    expect(
      getRegistry().find((entry) => entry.kind === 'deterministic' && entry.id === 'INSECURE_WEBHOOK_URL'),
    ).not.toHaveProperty('requires')
  })

  test('keeps unsupported source as non-secret inventory while secret scanning reports unreadable text', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig('write_script_tags'),
      'app/Main.java': 'x'.repeat(500_001),
    })
    const result = await scan(directory)

    expect(result.detection.languages).toEqual([{name: 'java', support: 'unsupported', files: ['app/Main.java']}])
    expect(result.scan.files_skipped).toContainEqual(
      expect.objectContaining({path: 'app/Main.java', reason: 'too_large'}),
    )
    expect(result.scan.checks_executed.find((check) => check.id === 'COMMITTED_SECRET')).toMatchObject({
      status: 'unresolved',
      reason: {code: 'input_rejected'},
    })
    expect(result.scan.coverage_gaps).not.toEqual([])
    expect(result.issues.map((issue) => issue.id)).toContain('DEPRECATED_SCRIPT_TAG_SCOPE')
  })
})

describe('runtime identities', () => {
  test('allows shared product IDs across provenance and rejects duplicate or orphan runners', () => {
    const shared = DETERMINISTIC_CHECKS.get('UNSAFE_INNERHTML')!
    const sharedCatalog = RULE_CATALOG.filter((entry) => entry.id === shared.id)
    expect(() =>
      assertRegistryInvariants({
        catalog: sharedCatalog,
        deterministic: [shared],
        agent: [{id: shared.id, version: shared.version, prompt_hash: `sha256:${'a'.repeat(64)}`, precedence: 'union'}],
      }),
    ).not.toThrow()
    expect(() =>
      assertRegistryInvariants({catalog: sharedCatalog, deterministic: [shared, shared], agent: []}),
    ).toThrow(/Duplicate deterministic stable ID/)
    expect(() =>
      assertRegistryInvariants({
        catalog: sharedCatalog,
        deterministic: [{...shared, id: 'ORPHAN'}],
        agent: [],
      }),
    ).toThrow(/Orphan deterministic runner/)
    expect(() =>
      assertRegistryInvariants({
        catalog: sharedCatalog,
        deterministic: [{...shared, lifecycle: 'planned'}],
        agent: [],
      }),
    ).toThrow(/non-active deterministic check can't have a runner/i)
    expect(() =>
      assertRegistryInvariants({
        catalog: sharedCatalog,
        deterministic: [{...shared, runner: undefined}],
        agent: [],
      }),
    ).toThrow(/has no runner/)
  })
})

describe('authenticated-route review handoff', () => {
  test('hands unresolved context authentication to the agent without a false finding or a passing check', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export const shopify = {}',
      'app/routes/orders.tsx':
        'export async function loader({request, context}: LoaderArgs) { const {admin} = await context.shopify.authenticate.admin(request); return admin.graphql("{ shop { id } }") }',
    })
    const result = await scan(directory)

    // Context-provided authentication must not be mistaken for missing verification.
    expect(result.issues.some((issue) => issue.id === 'UNAUTHENTICATED_ENDPOINT')).toBe(false)
    expect(result.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')).toMatchObject({
      status: 'unresolved',
      analysis_mode: 'regex',
      reason: {code: 'agent_investigation_required'},
    })
    expect(result.scan.coverage_gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'UNAUTHENTICATED_ENDPOINT'}),
    )

    const agentChecks = buildAgentChecks('test')
    expect(agentChecks.checks).toContainEqual(
      expect.objectContaining({
        id: 'UNAUTHENTICATED_ENDPOINT',
        version: 3,
      }),
    )
  })
  test('preserves ordinary findings when another handler needs context-auth review', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export const shopify = {}',
      'app/routes/orders.tsx': `export async function loader({request, context}) {
await context.shopify.authenticate.admin(request);
return prisma.order.findMany();
}
export async function action({request}) {
return prisma.order.deleteMany();
}`,
    })
    const result = await scan(directory)
    expect(result.issues.filter((issue) => issue.id === 'UNAUTHENTICATED_ENDPOINT')).toEqual([
      expect.objectContaining({location: {file: 'app/routes/orders.tsx', line: 5}}),
    ])
    expect(result.scan.checks_executed.find((execution) => execution.id === 'UNAUTHENTICATED_ENDPOINT')).toMatchObject({
      status: 'unresolved',
      analysis_mode: 'regex',
      findings: 1,
      reason: {code: 'agent_investigation_required'},
      inspected_files: expect.arrayContaining(['app/routes/orders.tsx']),
    })
  })
})
