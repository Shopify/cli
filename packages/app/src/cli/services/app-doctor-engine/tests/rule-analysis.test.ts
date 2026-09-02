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

async function writeFakeNpm(tools: string, source: string): Promise<void> {
  const jsPath = join(tools, 'npm.js')
  await writeFile(jsPath, source)
  await writeFile(
    join(tools, 'npm'),
    `#!/bin/sh
exec ${JSON.stringify(process.execPath)} ${JSON.stringify(jsPath)} "$@"
`,
    {mode: 0o755},
  )
  await writeFile(
    join(tools, 'npm.cmd'),
    `@echo off
"${process.execPath}" "${jsPath}" %*
`,
  )
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ESRCH' || code === 'EINVAL') return false
    if (code === 'EPERM') return true
    throw error
  }
}

const javascriptManifest = (directory: string): ManifestFile => ({
  path: 'package.json',
  absolutePath: join(directory, 'package.json'),
  type: 'npm',
  dependencies: {},
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
    const poison = `\`${'\\_'.repeat(40)}`

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
          if (command === 'npm') expect(args).toContain('--omit=dev')
          if (command === 'pnpm') expect(args).toContain('--prod')
          if (command === 'yarn') expect(args.slice(2, 4)).toEqual(['--groups', 'dependencies'])
          if (command === 'corepack') expect(args.slice(-2)).toEqual(['--environment', 'production'])
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
        expect(args).toEqual(['yarn@4.1.0', 'npm', 'audit', '--all', '--json', '--environment', 'production'])
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
      expect(Date.now() - started).toBeLessThan(1000)
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('bounds noisy audit output and times out without hanging', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-noisy-'))
    const tools = await mkdtemp(join(tmpdir(), 'app-doctor-audit-noisy-bin-'))
    vi.stubEnv('PATH', `${tools}${delimiter}${process.env.PATH ?? ''}`)
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      await writeFakeNpm(
        tools,
        `
setInterval(() => {
  process.stdout.write('x'.repeat(65536))
  process.stderr.write('x'.repeat(65536))
}, 10)
`,
      )
      const started = Date.now()
      const result = await auditKnownCves(directory, [javascriptManifest(directory)], undefined, 400)
      expect(result.unresolvedReason).toBe('Dependency audit timed out.')
      expect(Date.now() - started).toBeLessThan(4000)
    } finally {
      vi.unstubAllEnvs()
      await Promise.all([rm(directory, {recursive: true, force: true}), rm(tools, {recursive: true, force: true})])
    }
  })

  test('kills descendant audit processes before removing the sandbox', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-tree-'))
    const tools = await mkdtemp(join(tmpdir(), 'app-doctor-audit-tree-bin-'))
    const pidFile = join(tools, 'descendant.pid')
    vi.stubEnv('PATH', `${tools}${delimiter}${process.env.PATH ?? ''}`)
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      await writeFakeNpm(
        tools,
        `
const {spawn} = require('node:child_process')
const {writeFileSync} = require('node:fs')
const child = spawn(${JSON.stringify(process.execPath)}, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'})
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid))
setInterval(() => {}, 1000)
`,
      )
      const result = await auditKnownCves(directory, [javascriptManifest(directory)], undefined, 400)
      expect(result.unresolvedReason).toBe('Dependency audit timed out.')
      const pid = Number(await readFile(pidFile, 'utf8'))
      expect(Number.isInteger(pid)).toBe(true)
      await expect.poll(() => processExists(pid), {timeout: 3000}).toBe(false)
    } finally {
      vi.unstubAllEnvs()
      await Promise.all([rm(directory, {recursive: true, force: true}), rm(tools, {recursive: true, force: true})])
    }
  })

  test('parses package-manager fixtures and separates advisories from failures', async () => {
    expect(
      parseAuditOutput(
        JSON.stringify({advisories: {'1': {module_name: 'pnpm-package', severity: 'moderate'}}}),
        'pnpm',
      ),
    ).toEqual([{packageName: 'pnpm-package', severity: 'moderate', cves: [], topLevelParents: []}])
    expect(
      parseAuditOutput(
        JSON.stringify({children: {one: {ident: 'berry-package', severity: 'critical', children: {}}}}),
        'yarn-berry',
      ),
    ).toEqual([{packageName: 'berry-package', severity: 'critical', cves: [], topLevelParents: []}])
    expect(
      parseAuditOutput(
        JSON.stringify({value: 'tree-package', children: {Issue: 'advisory', Severity: 'high'}}),
        'yarn-berry',
      ),
    ).toEqual([{packageName: 'tree-package', severity: 'high', cves: [], topLevelParents: []}])
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

  test('collapses same-package advisories and puts CVE identity in the default title', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-collapse-'))
    try {
      await writeFile(join(directory, 'package-lock.json'), '{}')
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        dependencies: {lodash: '4.17.23'},
      }
      const result = await auditKnownCves(directory, [manifest], async () => ({
        stdout: JSON.stringify({
          vulnerabilities: {
            lodash: {
              severity: 'high',
              via: [
                {
                  title: 'lodash template injection',
                  url: 'https://github.com/advisories/GHSA-r5fr-rjxr-66jc',
                  cves: ['CVE-2026-4800'],
                  severity: 'high',
                },
                {
                  title: 'lodash prototype pollution',
                  url: 'https://github.com/advisories/GHSA-f23m-r3pf-42rh',
                  cves: ['CVE-2026-2950'],
                  severity: 'moderate',
                },
              ],
            },
          },
        }),
        stderr: '',
        exitCode: 1,
      }))
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        id: 'KNOWN_CVE_IN_DEPENDENCY',
        severity: 'high',
        points: -20,
        title: 'lodash has a high vulnerability (CVE-2026-4800 + 1 more)',
        location: {file: 'package-lock.json'},
      })
      expect(result.issues[0]?.message).toContain('CVE-2026-4800')
      expect(result.issues[0]?.message).toContain('CVE-2026-2950')
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('drops dev-only lockfile hits, collapses remaining packages, and treats zero production vulns as clean', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-prod-'))
    try {
      await writeFile(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9')
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        packageManager: 'pnpm@10.0.0',
        dependencies: {prisma: '^6.16.3'},
        devDependencies: {
          '@typescript-eslint/eslint-plugin': '^6.21.0',
          '@shopify/api-codegen-preset': '^2.0.0',
        },
      }
      const pnpmReport = {
        advisories: {
          '1113465': {
            module_name: 'minimatch',
            severity: 'high',
            cves: ['CVE-2026-26996'],
            url: 'https://github.com/advisories/GHSA-3ppc-4f35-3m26',
            findings: [
              {
                paths: ['.>@typescript-eslint/eslint-plugin>@typescript-eslint/typescript-estree>minimatch'],
              },
            ],
          },
          '1113544': {
            module_name: 'minimatch',
            severity: 'high',
            cves: ['CVE-2026-27903'],
            findings: [
              {
                paths: ['.>@typescript-eslint/eslint-plugin>@typescript-eslint/typescript-estree>minimatch'],
              },
            ],
          },
          '1113552': {
            module_name: 'minimatch',
            severity: 'high',
            cves: ['CVE-2026-27904'],
            findings: [
              {
                paths: ['.>@typescript-eslint/eslint-plugin>@typescript-eslint/typescript-estree>minimatch'],
              },
            ],
          },
          '1115806': {
            module_name: 'lodash',
            severity: 'high',
            cves: ['CVE-2026-4800'],
            findings: [
              {
                paths: ['.>@shopify/api-codegen-preset>@graphql-codegen/cli>lodash'],
              },
            ],
          },
          '1115810': {
            module_name: 'lodash',
            severity: 'moderate',
            cves: ['CVE-2026-2950'],
            findings: [
              {
                paths: ['.>@shopify/api-codegen-preset>@graphql-codegen/cli>lodash'],
              },
            ],
          },
          '1145093': {
            module_name: 'deepmerge-ts',
            severity: 'high',
            cves: ['CVE-2026-40345'],
            findings: [{paths: ['.>prisma>@prisma/config>deepmerge-ts']}],
          },
        },
      }
      const result = await auditKnownCves(directory, [manifest], async (command, args) => {
        expect(command).toBe('pnpm')
        expect(args).toContain('--prod')
        return {stdout: JSON.stringify(pnpmReport), stderr: '', exitCode: 1}
      })
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        id: 'KNOWN_CVE_IN_DEPENDENCY',
        severity: 'high',
        points: -20,
        title: 'deepmerge-ts has a high vulnerability (CVE-2026-40345)',
        location: {file: 'pnpm-lock.yaml'},
      })
      expect(result.issues[0]?.message).toContain('Pulled in via prisma')

      const clean = await auditKnownCves(directory, [manifest], async () => ({
        stdout: JSON.stringify({
          advisories: {
            '1113465': pnpmReport.advisories['1113465'],
            '1115806': pnpmReport.advisories['1115806'],
          },
        }),
        stderr: '',
        exitCode: 1,
      }))
      expect(clean.unresolvedReason).toBeUndefined()
      expect(clean.issues).toEqual([])
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  })

  test('real npm audit does not fail by double-loading the isolated config', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'app-doctor-audit-npm-'))
    try {
      await Promise.all([
        writeFile(
          join(directory, 'package.json'),
          JSON.stringify({name: 'app-doctor-audit-npm', version: '0.0.0', private: true}),
        ),
        writeFile(join(directory, 'package-lock.json'), JSON.stringify({lockfileVersion: 3, packages: {}})),
      ])
      const manifest: ManifestFile = {
        path: 'package.json',
        absolutePath: join(directory, 'package.json'),
        type: 'npm',
        dependencies: {},
      }
      const result = await auditKnownCves(directory, [manifest])
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.issues).toEqual([])
    } finally {
      await rm(directory, {recursive: true, force: true})
    }
  }, 20_000)
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
