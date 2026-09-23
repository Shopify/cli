/* eslint-disable no-restricted-imports -- detector coverage uses real temporary repositories */
import {buildReviewPack} from '../checks/index.js'
import {assertRegistryInvariants, getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS, scan} from '../scanners/index.js'
import {compileTrace, sha256, validateTrace} from '../trace/index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {TraceV3} from '../types.js'

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

function resign(trace: TraceV3): void {
  const {attestation: _attestation, ...unsigned} = trace
  trace.attestation = {digest: sha256(unsigned), signed: false}
}

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
    expect(configOnly.scan.coverage_complete).toBe(true)

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
    expect(unknown.scan.coverage_complete).toBe(false)
    expect(
      unknown.scan.checks_executed.find((execution) => execution.id === 'MISSING_COMPLIANCE_WEBHOOKS'),
    ).toMatchObject({status: 'executed'})
    expect(unknown.issues.some((issue) => issue.id === 'MISSING_COMPLIANCE_WEBHOOKS')).toBe(true)
    expect(
      unknown.scan.checks_executed.find((execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT')?.status,
    ).toBe('unsupported_framework')
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
        guidance: expect.stringMatching(/offline-token/i),
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

  test('does not report findings or hashes from a sibling app configuration', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'shopify.app.production.toml': appConfig('write_script_tags'),
    })

    const result = await scan(directory, 'shopify.app.toml')
    const deprecated = result.scan.checks_executed.find((execution) => execution.id === 'DEPRECATED_SCRIPT_TAG_SCOPE')

    expect(deprecated).toMatchObject({status: 'executed', findings: 0, inspected_files: ['shopify.app.toml']})
    expect(result.issues.filter((issue) => issue.id === 'DEPRECATED_SCRIPT_TAG_SCOPE')).toEqual([])
    expect(result.scan.file_hashes).not.toHaveProperty('shopify.app.production.toml')
    expect(result.scan.file_hashes).toHaveProperty('shopify.app.toml')
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
    expect(themeUnsafe.implementations?.map((implementation) => implementation.id)).toEqual([
      'theme-js-regex',
      'theme-liquid-ast',
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
    expect(mixedUnsafe.implementations?.map((implementation) => implementation.id)).toEqual([
      'react-router-js-regex',
      'theme-js-regex',
      'theme-liquid-ast',
    ])
    expect(mixed.issues.filter((issue) => issue.id === 'UNSAFE_INNERHTML')).toHaveLength(2)
    expect(validateTrace(compileTrace(mixed)).valid).toBe(true)
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
      genericReactRouter.scan.checks_executed.find((execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT')
        ?.status,
    ).toBe('unsupported_framework')

    const unsupportedStatuses = await Promise.all(
      ['rb', 'php', 'py', 'go'].map(async (extension) => {
        const unsupported = await scan(
          await app({'shopify.app.toml': appConfig(), [`app/server.${extension}`]: 'def route; end'}),
        )
        return unsupported.scan.checks_executed.find((execution) => execution.id === 'REQUEST_CONTROLLED_ADMIN_CONTEXT')
          ?.status
      }),
    )
    expect(unsupportedStatuses).toEqual(Array.from({length: 4}, () => 'unsupported_framework'))
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
    const fallback = buildReviewPack('test', skippedSource).checks.find(
      (check) => check.id === 'UNSAFE_INNERHTML',
    )?.deterministic_fallback
    expect(fallback).toMatchObject({
      check_id: 'UNSAFE_INNERHTML',
      check_version: DETERMINISTIC_CHECKS.get('UNSAFE_INNERHTML')!.version,
      prompt_hash: expect.stringMatching(/^sha256:/),
      framework: 'react_router',
      surface: 'react_router',
      languages: expect.arrayContaining([expect.objectContaining({name: 'typescript'})]),
      inspected_files: expect.arrayContaining(['app/routes/index.ts']),
      uninspected_files: expect.arrayContaining(['app/routes/skipped.ts']),
      search_boundary_files: expect.arrayContaining(['app/routes/index.ts', 'app/routes/skipped.ts']),
      reason: {code: 'input_rejected'},
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

    expect(execution).toMatchObject({status: 'executed', required: true, applicable: true})
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
      'node_modules/vendor/index.java': 'ignored',
      'tests/example.java': 'ignored',
      'fixtures/example.java': 'ignored',
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
    expect(result.scan.coverage_complete).toBe(false)
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
        agent: [{id: shared.id, version: shared.version, prompt_hash: `sha256:${'a'.repeat(64)}`}],
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

describe('coverage and trace invariants', () => {
  test('rejects impossible execution and completeness combinations', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export const shopify = {}',
      'app/routes/index.ts': 'export const loader = () => null',
    })
    const trace = compileTrace(await scan(directory), {generatedAt: '2026-08-31T00:00:00.000Z'})
    const sourceExecution = trace.checks_executed.find(
      (execution) =>
        execution.kind === 'deterministic' && execution.analysis_mode === 'regex' && execution.status === 'executed',
    )!

    sourceExecution.inspected_files = []
    resign(trace)
    expect(validateTrace(trace).errors.join(' ')).toMatch(/requires inspected files/)

    trace.coverage.complete = true
    sourceExecution.status = 'unresolved'
    sourceExecution.required = true
    sourceExecution.reason = {code: 'parser_unavailable', message: 'Parser failed.'}
    sourceExecution.guidance = 'Inspect this check with an agent.'
    resign(trace)
    expect(validateTrace(trace).errors.join(' ')).toMatch(/coverage complete claim is inconsistent/)

    sourceExecution.status = 'unsupported_framework'
    sourceExecution.findings = 1
    resign(trace)
    expect(validateTrace(trace).errors.join(' ')).toMatch(/zero findings/)

    delete sourceExecution.guidance
    resign(trace)
    expect(validateTrace(trace).errors.join(' ')).toMatch(/reason and handoff guidance/)
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

    const reviewPack = buildReviewPack('test', result)
    expect(reviewPack.checks).toContainEqual(
      expect.objectContaining({
        id: 'UNAUTHENTICATED_ENDPOINT',
        version: 2,
        deterministic_fallback: expect.objectContaining({
          reason: expect.objectContaining({code: 'agent_investigation_required'}),
        }),
      }),
    )

    // A deferred context pattern must not make an unperformed agent review look complete.
    const trace = compileTrace(result)
    expect(trace.checks_executed).toContainEqual(
      expect.objectContaining({
        id: 'UNAUTHENTICATED_ENDPOINT',
        kind: 'agent',
        status: 'unresolved',
        reason: expect.objectContaining({code: 'not_reported'}),
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
