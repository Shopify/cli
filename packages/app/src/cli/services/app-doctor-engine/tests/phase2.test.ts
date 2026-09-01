/* eslint-disable no-restricted-imports -- detector coverage uses real temporary repositories */
import {
  DETERMINISTIC_CHECKS,
  assertRegistryInvariants,
  buildReviewPack,
  compileTrace,
  formatConsole,
  scan,
  sha256,
  validateTrace,
} from '../index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {calculateScore} from '../scorer/index.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {Issue, TraceV2} from '../types.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function app(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'app-doctor-phase2-'))
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

const appConfig = (scopes = '') => `name = "Phase 2"\n[access_scopes]\nscopes = "${scopes}"\n`
const reactPackage = JSON.stringify({dependencies: {'@shopify/shopify-app-react-router': '^1.0.0'}})

function resign(trace: TraceV2): void {
  const {attestation: _attestation, ...unsigned} = trace
  trace.attestation = {digest: sha256(unsigned), signed: false}
}

describe('framework and surface detection', () => {
  test('grades the React Router green path only when package and structure agree', async () => {
    const directory = await app({
      'shopify.app.toml': appConfig(),
      'package.json': reactPackage,
      'app/shopify.server.ts': 'export const shopify = {}',
      'app/routes/index.tsx': 'export const loader = () => null',
    })
    const result = await scan(directory)

    expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
    expect(result.scan.coverage_complete).toBe(false)
    expect(result.scan.coverage_gaps.some((gap) => gap.check_id === 'KNOWN_CVE_IN_DEPENDENCY')).toBe(true)
  })

  test('detects config-only, theme extension, mixed, and unknown surfaces', async () => {
    const configOnly = await scan(await app({'shopify.app.toml': appConfig()}))
    expect(configOnly.detection).toMatchObject({framework: 'none', surface: 'config_only'})
    expect(configOnly.score).not.toBeNull()

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
    expect(unknown.score).toBeNull()
    expect(formatConsole(unknown)).toContain('Unsupported backend: agent tier only')
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
    const malformedConfig = await scan(
      await app({
        'shopify.app.toml': appConfig(),
        'shopify.app.invalid.toml': 'name = [',
      }),
    )
    expect(malformedConfig.scan.checks_executed.find((execution) => execution.id === 'EOL_API_VERSION')).toMatchObject({
      status: 'unresolved',
      reason: {code: 'parser_unavailable'},
    })

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
      check_version: 1,
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
    expect(result.score).toBeNull()
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
        agent: [{id: shared.id, version: 1, prompt_hash: `sha256:${'a'.repeat(64)}`}],
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
  test('does not double-deduct agent and deterministic evidence for one product', () => {
    const issue: Issue = {
      id: 'UNSAFE_INNERHTML',
      severity: 'high',
      points: -25,
      title: 'Unsafe HTML',
      message: 'Unsafe HTML',
      location: {file: 'app/a.ts', line: 1},
      evidence: [{location: {file: 'app/a.ts', line: 1}, quote: 'element.innerHTML = input'}],
      fix: {automated: false, description: 'Sanitize input.'},
      found_by: 'static',
    }
    expect(calculateScore([issue, {...issue, found_by: 'agent', confidence: 'agentic'}]).total).toBe(75)
  })

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
