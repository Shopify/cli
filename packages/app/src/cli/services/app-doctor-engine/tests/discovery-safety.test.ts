/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {AppRootDiscoveryError, findAppRoot} from '../scanners/discover.js'
import {scan} from '../scanners/index.js'
import {normalizePath} from '@shopify/cli-kit/node/path'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {AuditExecutor} from '../rules/dependency-rules.js'

const temporaryDirectories: string[] = []
const appConfiguration = 'name = "Discovery safety"\napplication_url = "https://example.com"\n'
const harmlessAudit: AuditExecutor = async () => ({
  stdout: JSON.stringify({metadata: {vulnerabilities: {total: 0}}}),
  stderr: '',
  exitCode: 0,
})

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function makeDirectory(prefix = 'app-doctor-discovery-'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(root, path)
      await mkdir(join(fullPath, '..'), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
}

describe.sequential('app root discovery', () => {
  test('walks up from explicit and current subdirectories and accepts an explicit TOML', async () => {
    const root = await makeDirectory()
    const routes = join(root, 'app', 'routes')
    const toml = join(root, 'shopify.app.staging.toml')
    await mkdir(routes, {recursive: true})
    await writeFile(toml, appConfiguration)

    const normalizedRoot = normalizePath(root)
    expect(findAppRoot(routes)).toBe(normalizedRoot)
    expect(findAppRoot(toml)).toBe(normalizedRoot)

    const previousInitialDirectory = process.env.INIT_CWD
    process.env.INIT_CWD = routes
    try {
      expect(findAppRoot()).toBe(normalizedRoot)
    } finally {
      if (previousInitialDirectory === undefined) delete process.env.INIT_CWD
      else process.env.INIT_CWD = previousInitialDirectory
    }
  })

  test('fails clearly for an explicit missing path instead of scanning cwd', async () => {
    const root = await makeDirectory()
    const missing = join(root, 'missing-app')
    expect(() => findAppRoot(missing)).toThrow(AppRootDiscoveryError)
    expect(() => findAppRoot(missing)).toThrow(`App path does not exist: ${missing}`)
  })
})

describe('repository discovery exclusions', () => {
  test('excludes every nested app input from its parent monorepo scan', async () => {
    const root = await makeDirectory()
    const secret = ['AKIA', 'IOSFODNN7EXAMPLE'].join('')
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'parent.ts': 'export const parent = true',
      'apps/child/shopify.app.toml': 'name = "Child"\n',
      'apps/child/package.json': JSON.stringify({dependencies: {'@shopify/shopify-app-react-router': '1.0.0'}}),
      'apps/child/app/routes/child.ts': `export const leaked = "${secret}"`,
      'apps/child/extensions/theme/shopify.extension.toml': 'type = "theme"\n',
      'apps/child/extensions/theme/blocks/app.liquid': '{{ block.settings.value }}',
      'apps/child/secrets.json': secret,
    })

    const result = await scan(root)
    expect(Object.keys(result.scan.file_hashes ?? {})).toContain('parent.ts')
    expect(Object.keys(result.scan.file_hashes ?? {}).some((path) => path.startsWith('apps/child/'))).toBe(false)
    expect(result.capabilities.theme_app_extension).toBe(false)
    expect(result.detection.framework).not.toBe('react_router')
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(result.issues.some((issue) => issue.location.file.startsWith('apps/child/'))).toBe(false)
  })

  test('recursively excludes dependency, VCS, coverage, and build directories', async () => {
    const root = await makeDirectory()
    const ignoredDirectories = ['node_modules', 'vendor', '.git', '.next', 'coverage', 'dist', 'build']
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'src/index.ts': 'export const included = true',
      ...Object.fromEntries(
        ignoredDirectories.map((directory) => [
          `packages/service/${directory}/ignored.ts`,
          'export const ignored = true',
        ]),
      ),
    })

    const result = await scan(root)
    const paths = Object.keys(result.scan.file_hashes ?? {})
    expect(paths).toContain('src/index.ts')
    for (const directory of ignoredDirectories)
      expect(paths.some((path) => path.includes(`/${directory}/`))).toBe(false)
  })

  test('keeps scanner-owned artifacts and atomic siblings out of stable scan inputs', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'src/index.ts': 'export const stable = true'})
    const before = await scan(root)
    await writeFiles(root, {
      '.shopify/app-doctor/review.json': '{"changed":true}',
      '.shopify/app-doctor/trace.json': '{"changed":true}',
      '.shopify/app-doctor/findings.json': '{"changed":true}',
    })
    const after = await scan(root)

    expect(after.scan.input_hash).toBe(before.scan.input_hash)
    expect(after.scan.file_hashes).toEqual(before.scan.file_hashes)
    expect(Object.keys(after.scan.file_hashes ?? {}).some((path) => path.includes('.shopify/app-doctor'))).toBe(false)
  })

  test('scans unconfigured extension files outside extension_directories', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': `${appConfiguration}extension_directories = ["configured"]\n`,
      'configured/shopify.extension.toml': 'type = "theme"\n',
      'configured/blocks/configured.liquid': '{{ shop.name }}',
      'unconfigured/shopify.extension.toml': 'type = "theme"\n',
      'unconfigured/blocks/unconfigured.liquid': '{{ shop.name }}',
    })

    const result = await scan(root)
    const paths = Object.keys(result.scan.file_hashes ?? {})

    expect(result.capabilities.theme_app_extension).toBe(true)
    expect(paths).toEqual(
      expect.arrayContaining([
        'configured/shopify.extension.toml',
        'configured/blocks/configured.liquid',
        'unconfigured/shopify.extension.toml',
        'unconfigured/blocks/unconfigured.liquid',
      ]),
    )
  })
})

describe('dependency audit input hashes', () => {
  for (const [manager, lockfile, content] of [
    ['npm@10.0.0', 'package-lock.json', '{"lockfileVersion":3}'],
    ['pnpm@10.0.0', 'pnpm-lock.yaml', 'lockfileVersion: 9'],
    ['yarn@4.1.0', 'yarn.lock', '# yarn lock'],
  ] as const) {
    test(`hashes the selected ${lockfile} bytes`, async () => {
      const root = await makeDirectory()
      await writeFiles(root, {
        'shopify.app.toml': appConfiguration,
        'package.json': JSON.stringify({packageManager: manager}),
        [lockfile]: content,
      })
      const options = {dependencyAuditExecutor: harmlessAudit}
      const before = await scan(root, options)
      await writeFile(join(root, lockfile), `${content}\nchanged`)
      const after = await scan(root, options)

      expect(before.scan.file_hashes?.[lockfile]).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(after.scan.file_hashes?.[lockfile]).not.toBe(before.scan.file_hashes?.[lockfile])
      expect(after.scan.input_hash).not.toBe(before.scan.input_hash)
    })
  }

  test('hashes only the lockfile selected by packageManager when candidates coexist', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'package.json': JSON.stringify({packageManager: 'yarn@4.1.0'}),
      'package-lock.json': '{"lockfileVersion":3}',
      'pnpm-lock.yaml': 'lockfileVersion: 9',
      'yarn.lock': '# selected yarn lock',
    })
    const result = await scan(root, {dependencyAuditExecutor: harmlessAudit})

    expect(result.scan.file_hashes).toHaveProperty('yarn.lock')
    expect(result.scan.file_hashes).not.toHaveProperty('package-lock.json')
    expect(result.scan.file_hashes).not.toHaveProperty('pnpm-lock.yaml')
  })
})
