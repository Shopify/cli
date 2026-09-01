/* eslint-disable no-restricted-imports -- scanners are tested with real temporary repositories */
import {scanEolApiVersions, isEolApiVersion} from '../rules/compliance-rules.js'
import {auditKnownCves, parseAuditOutput} from '../rules/dependency-rules.js'
import {
  scanCredentialBrowserLeakage,
  scanCredentialLogLeakage,
  scanRequestControlledAdminContext,
  scanUnsafeInnerHTML,
} from '../rules/js-rules.js'
import {scanLiquidSecurity} from '../rules/liquid-rules.js'
import {scanDeprecatedScriptTagApi} from '../rules/shopify-rules.js'
import {scanExpiringOfflineTokens} from '../rules/token-rules.js'
import {describe, expect, test, vi} from 'vitest'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {delimiter, extname, join, relative} from 'node:path'
import {tmpdir} from 'node:os'
import type {ManifestFile, ScanContext, SourceFile} from '../rules/types.js'

const source = (content: string, path = 'app/routes/example.tsx'): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: extname(path),
  content,
})

function context(
  input: {
    files?: SourceFile[]
    appTomls?: ScanContext['appTomls']
    framework?: ScanContext['detection']['framework']
  } = {},
): ScanContext {
  const appTomls = input.appTomls ?? []
  return {
    appRoot: '/app',
    appToml: appTomls[0] ?? null,
    appTomls,
    extensions: [],
    sourceFiles: input.files ?? [],
    manifests: [],
    sensitiveFiles: [],
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
    detection: {framework: input.framework ?? 'react_router', surface: 'react_router', languages: []},
    sourceCandidates: [],
  }
}

describe('REQUEST_CONTROLLED_ADMIN_CONTEXT trust provenance', () => {
  test('flags direct, destructured, and multiline request values even after authentication', () => {
    const findings = scanRequestControlledAdminContext([
      source(`export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();
  const requestedShop =
    formData.get("shop");
  await unauthenticated.admin(
    requestedShop,
  );
  const {shopDomain: jsonShop} = await request.json();
  await unauthenticated.admin(jsonShop);
  await unauthenticated.admin(request.query.shop);
  return session.shop;
}`),
    ])

    expect(findings).toHaveLength(3)
    expect(findings.map((finding) => finding.location.line)).toEqual([6, 10, 11])
  })

  test('trusts only shops actually derived from authentication/session output', () => {
    const findings = scanRequestControlledAdminContext([
      source(`export const loader = async ({request}) => {
  const authenticated = await authenticate.admin(request);
  await unauthenticated.admin(authenticated.session.shop);
  const {session} = authenticated;
  const {shop} = session;
  await unauthenticated.admin(shop);
  // unauthenticated.admin(request.query.shop)
  return "unauthenticated.admin(formData.get('shop'))";
}`),
    ])

    expect(findings).toEqual([])
  })
})

describe('string masking', () => {
  test('does not hang on unclosed template literals with repeated escapes', () => {
    const poison = '`' + '\\_'.repeat(40)

    expect(
      scanRequestControlledAdminContext([
        source(`${poison}
export const action = async ({request}) => {
  await unauthenticated.admin(request.query.shop);
}`),
      ]),
    ).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source(`${poison}\nelement.innerHTML = payload`)])).toHaveLength(1)
    expect(
      scanEolApiVersions(
        context({
          files: [
            source(
              `${poison}\nexport default shopifyApp({apiVersion: ApiVersion.January24});`,
              'app/shopify.server.mts',
            ),
          ],
        }),
        new Date('2026-08-31T00:00:00.000Z'),
      ).map((finding) => finding.location.file),
    ).toEqual(['app/shopify.server.mts'])
  })
})

describe('EOL_API_VERSION quarterly lifecycle', () => {
  test('uses a 12-month window plus the documented 30-day extension grace', () => {
    expect(isEolApiVersion('2025-07', new Date('2026-07-30T00:00:00.000Z'))).toBe(false)
    expect(isEolApiVersion('2025-07', new Date('2026-07-31T00:00:00.000Z'))).toBe(true)
    expect(isEolApiVersion('2025-10', new Date('2026-08-31T00:00:00.000Z'))).toBe(false)
    expect(isEolApiVersion('unstable', new Date('2026-08-31T00:00:00.000Z'))).toBe(false)
  })

  test('checks every parsed TOML and high-signal React Router server declarations only', () => {
    const findings = scanEolApiVersions(
      context({
        appTomls: [
          {raw: {}, path: '/app/shopify.app.toml', apiVersion: '2025-04', redirectUrls: [], webhooks: []},
          {raw: {}, path: '/app/shopify.app.production.toml', apiVersion: '2025-07', redirectUrls: [], webhooks: []},
        ],
        files: [
          source(
            `export default shopifyApp({
  apiVersion:
    ApiVersion.April25,
});
// apiVersion: ApiVersion.January24`,
            'app/shopify.server.mts',
          ),
          source('const apiVersion = ApiVersion.January24', 'app/routes/example.mts'),
        ],
      }),
      new Date('2026-08-31T00:00:00.000Z'),
    )

    expect(findings.map((finding) => finding.location.file)).toEqual([
      'shopify.app.toml',
      'shopify.app.production.toml',
      'app/shopify.server.mts',
    ])
  })
})

describe('EXPIRING_OFFLINE_TOKEN supported React Router analysis', () => {
  test('reports explicit false but never treats isOnline false as disabling expiry', () => {
    const result = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            `shopifyApp({
  future: {expiringOfflineAccessTokens: false},
  isOnline: false,
  sessionStorage: new MemorySessionStorage(),
})`,
            'app/shopify.server.ts',
          ),
        ],
      }),
    )
    expect(result.issues).toHaveLength(1)
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('returns clean only when enablement and refresh-compatible storage are visible', () => {
    const memory = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, isOnline: false, sessionStorage: new MemorySessionStorage()})',
            'app/shopify.server.cts',
          ),
        ],
      }),
    )
    expect(memory).toMatchObject({issues: []})
    expect(memory.unresolvedReason).toBeUndefined()

    const prisma = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, sessionStorage: new PrismaSessionStorage(prisma)})',
            'app/shopify.server.ts',
          ),
          source(
            'model Session {\n expires DateTime?\n refreshToken String?\n refreshTokenExpires DateTime?\n}',
            'prisma/schema.prisma',
          ),
        ],
      }),
    )
    expect(prisma.unresolvedReason).toBeUndefined()
  })

  test('hands absent flags and ambiguous storage to the unresolved runner path', () => {
    const absent = scanExpiringOfflineTokens(
      context({
        files: [source('shopifyApp({isOnline: false, sessionStorage})', 'app/shopify.server.ts')],
      }),
    )
    expect(absent.issues).toEqual([])
    expect(absent.unresolvedReason).toMatch(/not found/)

    const ambiguous = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, sessionStorage: new PrismaSessionStorage(prisma)})',
            'app/shopify.server.ts',
          ),
        ],
      }),
    )
    expect(ambiguous.unresolvedReason).toMatch(/compatibility/)
  })
})

describe('dependency audit selection and output handling', () => {
  test('packageManager selects one conflicting lockfile and uses correct commands', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-selection-'))
    try {
      await Promise.all([
        writeFile(join(directory, 'package-lock.json'), '{}'),
        writeFile(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9'),
        writeFile(join(directory, 'yarn.lock'), '# lock'),
      ])
      const run = async (
        packageManager: string,
        expectedCommand: string,
        expectedArgs: string[],
        stdout = JSON.stringify({metadata: {vulnerabilities: {total: 0}}}),
      ) => {
        const manifest: ManifestFile = {
          path: 'package.json',
          absolutePath: join(directory, 'package.json'),
          type: 'npm',
          dependencies: {},
          packageManager,
        }
        const result = await auditKnownCves(directory, [manifest], async (command, args, options) => {
          expect(command).toBe(expectedCommand)
          expect(args.slice(0, expectedArgs.length)).toEqual(expectedArgs)
          expect(options.cwd).not.toBe(directory)
          expect(options.env).not.toHaveProperty('NODE_AUTH_TOKEN')
          expect(options.env.NPM_CONFIG_REGISTRY).toBe('https://registry.npmjs.org/')
          expect(options.env.NPM_CONFIG_IGNORE_SCRIPTS).toBe('true')
          return {stdout, stderr: '', exitCode: 0}
        })
        expect(result.unresolvedReason).toBeUndefined()
        expect(result.inspectedFiles).toHaveLength(2)
      }
      await run('npm@10.0.0', 'npm', ['audit', '--json'])
      await run('pnpm@10.0.0', 'pnpm', ['audit', '--json'])
      await run(
        'yarn@1.22.22',
        'yarn',
        ['audit', '--json'],
        JSON.stringify({type: 'auditSummary', data: {vulnerabilities: {}}}),
      )
      await run(
        'yarn@4.1.0',
        'corepack',
        ['yarn@4.1.0', 'npm', 'audit', '--all', '--json'],
        JSON.stringify({children: {}}),
      )
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('isolates package-manager audit from repository config, scripts, and secret environment', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-boundary-'))
    vi.stubEnv('SHOPIFY_TEST_AUDIT_SECRET', 'must-not-cross-audit-boundary')
    vi.stubEnv('PATH', `${join(directory, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`)
    try {
      await Promise.all([
        writeFile(join(directory, 'yarn.lock'), '# exact selected lock bytes\n'),
        writeFile(join(directory, '.yarnrc.yml'), 'yarnPath: ./malicious.cjs\nplugins:\n  - ./malicious.cjs\n'),
        writeFile(join(directory, 'malicious.cjs'), 'throw new Error("repository script executed")\n'),
        writeFile(
          join(directory, 'package.json'),
          JSON.stringify({
            scripts: {preaudit: 'node malicious.cjs'},
            packageManager: 'yarn@4.1.0',
            dependencies: {local: `file:${directory}`, remote: 'https://registry.invalid/package.tgz'},
          }),
        ),
      ])
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        content: JSON.stringify({scripts: {preaudit: 'node malicious.cjs'}, packageManager: 'yarn@4.1.0'}),
        dependencies: {
          safe: '1.0.0',
          local: `file:${directory}`,
          remote: 'https://registry.invalid/package.tgz',
        },
        packageManager: 'yarn@4.1.0',
      }
      let sandboxPath = ''
      const result = await auditKnownCves(directory, [manifest], async (command, args, options) => {
        sandboxPath = options.cwd
        expect(command).toBe('corepack')
        expect(args).toEqual(['yarn@4.1.0', 'npm', 'audit', '--all', '--json'])
        expect(relative(directory, options.cwd).startsWith('..')).toBe(true)
        expect(options.env.PATH).not.toContain(directory)
        await expect(readFile(join(options.cwd, 'yarn.lock'), 'utf8')).resolves.toBe('# exact selected lock bytes\n')
        const sandboxManifest = JSON.parse(await readFile(join(options.cwd, 'package.json'), 'utf8'))
        expect(sandboxManifest).not.toHaveProperty('scripts')
        expect(sandboxManifest.packageManager).toBe('yarn@4.1.0')
        expect(sandboxManifest.dependencies).toEqual({safe: '1.0.0'})
        await expect(readFile(join(options.cwd, '.yarnrc.yml'), 'utf8')).rejects.toThrow()
        await expect(readFile(join(options.cwd, 'malicious.cjs'), 'utf8')).rejects.toThrow()
        expect(options.env).not.toHaveProperty('SHOPIFY_TEST_AUDIT_SECRET')
        expect(options.env).not.toHaveProperty('NODE_OPTIONS')
        expect(options.env.HOME).not.toBe(process.env.HOME)
        expect(options.env.YARN_IGNORE_PATH).toBe('1')
        expect(options.env.YARN_ENABLE_SCRIPTS).toBe('false')
        expect(options.env.YARN_NPM_REGISTRY_SERVER).toBe('https://registry.npmjs.org/')
        return {stdout: JSON.stringify({children: {}}), stderr: '', exitCode: 0}
      })
      expect(result.unresolvedReason).toBeUndefined()
      await expect(readFile(join(sandboxPath, 'package.json'), 'utf8')).rejects.toThrow()
    } finally {
      vi.unstubAllEnvs()
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('enforces timeout when an executor ignores AbortSignal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-timeout-'))
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        dependencies: {},
      }
      const started = Date.now()
      const result = await auditKnownCves(directory, [manifest], () => new Promise(() => {}), 10)
      expect(result.unresolvedReason).toBe('Dependency audit timed out.')
      expect(Date.now() - started).toBeLessThan(500)
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('parses package-manager fixtures and separates advisories from failures', async () => {
    expect(
      parseAuditOutput(
        JSON.stringify({advisories: {'1': {module_name: 'pnpm-package', severity: 'moderate'}}}),
        'pnpm',
      ),
    ).toEqual([{packageName: 'pnpm-package', severity: 'moderate'}])
    expect(
      parseAuditOutput(
        JSON.stringify({children: {one: {ident: 'berry-package', severity: 'critical', children: {}}}}),
        'yarn-berry',
      ),
    ).toEqual([{packageName: 'berry-package', severity: 'critical'}])
    expect(
      parseAuditOutput(
        JSON.stringify({value: 'tree-package', children: {Issue: 'advisory', Severity: 'high'}}),
        'yarn-berry',
      ),
    ).toEqual([{packageName: 'tree-package', severity: 'high'}])
    expect(parseAuditOutput(JSON.stringify({error: {code: 'ENETUNREACH'}}), 'npm')).toBeNull()

    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-severity-'))
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        dependencies: {},
      }
      const result = await auditKnownCves(directory, [manifest], async () => ({
        stdout: JSON.stringify({
          vulnerabilities: {
            criticalPackage: {severity: 'critical'},
            moderatePackage: {severity: 'moderate'},
            infoPackage: {severity: 'info'},
          },
        }),
        stderr: '',
        exitCode: 1,
      }))
      expect(result.issues.map(({severity, points}) => ({severity, points}))).toEqual([
        {severity: 'high', points: -20},
        {severity: 'medium', points: -10},
        {severity: 'low', points: -5},
      ])
      expect(result.issues.every((finding) => finding.location.file === 'package-lock.json')).toBe(true)

      const operational = await auditKnownCves(directory, [manifest], async () => ({
        stdout: JSON.stringify({metadata: {vulnerabilities: {total: 0}}}),
        stderr: 'offline',
        exitCode: 1,
      }))
      expect(operational.unresolvedReason).toMatch(/operationally/)
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })
})

describe('Liquid public AST analysis', () => {
  test('distinguishes ordinary src attributes from executable contexts', () => {
    const ordinary = scanLiquidSecurity([
      source('<img src="{{ block.settings.image | escape }}">', 'extensions/theme/blocks/image.liquid'),
    ])
    expect(ordinary.issues).toEqual([])

    const script = scanLiquidSecurity([
      source('<script src="{{ block.settings.script | escape }}"></script>', 'extensions/theme/blocks/script.liquid'),
    ])
    expect(script.issues.map((finding) => finding.id)).toEqual(['LIQUID_UNSAFE_RENDER', 'UNSAFE_INNERHTML'])
  })

  test('uses context-specific filters, AST positions, and preserves raw/comment negatives', () => {
    const safe = scanLiquidSecurity([
      source(
        `{% comment %}<script>{{ block.settings.bad }}</script>{% endcomment %}
{% raw %}<script>{{ block.settings.literal }}</script>{% endraw %}
<div title="{{ block.settings.title | escape }}"></div>
<script>const value = {{ block.settings.value | json }};</script>`,
        'extensions/theme/blocks/safe.liquid',
      ),
    ])
    expect(safe.issues).toEqual([])

    const unsafe = scanLiquidSecurity([
      source(
        '\n  <button\n    onclick="{{ block.settings.handler }}">Run</button>',
        'extensions/theme/blocks/unsafe.liquid',
      ),
    ])
    expect(unsafe.issues).toHaveLength(2)
    expect(unsafe.issues[0]?.location).toEqual({file: 'extensions/theme/blocks/unsafe.liquid', line: 3, column: 14})
    expect(scanLiquidSecurity([source('{% if', 'extensions/theme/blocks/broken.liquid')]).parserFailures).toEqual([
      'extensions/theme/blocks/broken.liquid',
    ])
  })
})

describe('JavaScript credential and executable sinks', () => {
  test('supports module extensions and keeps direct flows high signal', () => {
    expect(
      scanCredentialLogLeakage([source('console.error("request failed", accessToken)', 'server/log.mjs')]),
    ).toHaveLength(1)
    expect(
      scanCredentialLogLeakage([
        source(['console.error(`', '$', '{requestId} ', '$', '{accessToken}`)'].join(''), 'server/log.mjs'),
      ]),
    ).toHaveLength(1)
    expect(scanCredentialBrowserLeakage([source('return json({clientSecret})', 'app/routes/a.cts')])).toHaveLength(1)
    expect(
      scanCredentialBrowserLeakage([
        source('fetch("https://example.test/report", {headers: {Authorization: sessionToken}})', 'app/routes/a.mts'),
      ]),
    ).toHaveLength(1)
    expect(
      scanCredentialBrowserLeakage([
        source('fetch("/internal", {headers: {Authorization: sessionToken}})', 'app/routes/a.mts'),
      ]),
    ).toEqual([])
    expect(scanCredentialLogLeakage([source('console.info("accessToken")', 'server/log.cjs')])).toEqual([])
    expect(scanCredentialLogLeakage([source('// console.log(accessToken)', 'server/log.mts')])).toEqual([])
    expect(
      scanCredentialLogLeakage([
        source(
          'console.info({redacted: redact(accessToken), hash: createHash("sha256").update(clientSecret).digest("hex"), present: Boolean(sessionToken)})',
          'server/log.mjs',
        ),
      ]),
    ).toEqual([])
  })

  test('flags dynamic evaluation but ignores static examples, strings, and comments', () => {
    expect(scanUnsafeInnerHTML([source('eval(payload); new Function(source)', 'server/eval.cjs')])).toHaveLength(1)
    expect(
      scanUnsafeInnerHTML([
        source('// eval(payload)\nconst example = "new Function(source)"; eval("fixed expression")', 'server/eval.mts'),
      ]),
    ).toEqual([])
  })

  test('retains the only active Shopify-specific source rule on modern module extensions', () => {
    expect(
      scanDeprecatedScriptTagApi([
        source(
          'admin.graphql(`mutation { scriptTagCreate(input: $input) { scriptTag { id } } }`)',
          'server/install.mjs',
        ),
      ]),
    ).toHaveLength(1)
  })
})
