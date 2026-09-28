/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {
  AppRootDiscoveryError,
  findAppRoot,
  findExtensions,
  findSourceCandidates,
  getSkippedFiles,
  listRepositoryFiles,
  resetSkippedFiles,
} from '../scanners/discover.js'
import {scan} from '../scanners/index.js'
import {buildPathRules, listGitIgnoredPaths} from '../scanners/path-rules.js'
import {normalizePath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {chmod, mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {PathRules} from '../scanners/path-rules.js'
import type {ScanResult} from '../types.js'

const temporaryDirectories: string[] = []
const appConfiguration = 'name = "Discovery safety"\napplication_url = "https://example.com"\n'
/** The rules a scan uses when git reports no ignored paths. */
const DEFAULT_RULES = buildPathRules({gitIgnoredPaths: []})

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function makeDirectory(prefix = 'app-security-discovery-'): Promise<string> {
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

async function makeRepository(files: Record<string, string>): Promise<string> {
  const root = await makeDirectory()
  git(root, ['init', '-q', '.'])
  await writeFiles(root, files)
  return root
}

function hashedPaths(result: ScanResult): string[] {
  return Object.keys(result.scan.file_hashes ?? {})
}

function secretFindingFiles(result: ScanResult): string[] {
  return result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET').map((issue) => issue.location.file)
}

/** Paths the dependency check inspected, which is where package manifests surface in a scan result. */
function inspectedManifestPaths(result: ScanResult): string[] {
  const execution = result.scan.checks_executed.find(
    (candidate) => candidate.id === 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
  )
  return execution?.inspected_files.filter((path) => path.endsWith('package.json')) ?? []
}

/** Rules exactly as `scan()` builds them, so direct finder tests see the same file list. */
async function scanPathRules(appRoot: string): Promise<PathRules> {
  const listing = await listGitIgnoredPaths(appRoot)
  return buildPathRules({gitIgnoredPaths: listing.status === 'listed' ? listing.paths : []})
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

  test('ignores files that match the glob but are not CLI app configuration names', async () => {
    const root = await makeDirectory()
    await writeFile(join(root, 'shopify.application.toml'), appConfiguration)
    await writeFile(join(root, 'shopify.app.foo.bar.toml'), appConfiguration)
    expect(() => findAppRoot(root)).toThrow(AppRootDiscoveryError)
  })

  test('rejects an explicit non-app TOML path with a configuration-file error', async () => {
    const root = await makeDirectory()
    const webToml = join(root, 'shopify.web.toml')
    await writeFile(webToml, 'type = "frontend"\n')
    expect(() => findAppRoot(webToml)).toThrow(AppRootDiscoveryError)
    expect(() => findAppRoot(webToml)).toThrow(
      `App path is not a directory or Shopify app configuration file: ${webToml}`,
    )
  })
})

describe('repository discovery exclusions', () => {
  // scan() asks git for ignored paths, so keep results independent of the developer's git configuration.
  let restoreGitConfig: (() => void) | undefined
  beforeEach(() => {
    restoreGitConfig = isolateGitConfig()
  })
  afterEach(() => {
    restoreGitConfig?.()
  })

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

  test('recursively excludes dependency, VCS, coverage, build, and test directories', async () => {
    const root = await makeDirectory()
    const ignoredDirectories = [
      'node_modules',
      'vendor',
      '.git',
      '.next',
      'coverage',
      'dist',
      'build',
      'test',
      'tests',
      'spec',
      'specs',
      '__tests__',
      'fixtures',
      'x-fixtures',
      '__fixtures__',
    ]
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'src/index.ts': 'export const included = true',
      'packages/service/lib/index.test.ts': 'export const ignored = true',
      'packages/service/lib/index.spec.js': 'export const ignored = true',
      ...Object.fromEntries(
        ignoredDirectories.map((directory) => [
          `packages/service/${directory}/ignored.ts`,
          'export const ignored = true',
        ]),
      ),
    })

    const result = await scan(root)
    const paths = hashedPaths(result)
    expect(paths).toContain('src/index.ts')
    for (const directory of ignoredDirectories)
      expect(paths.some((path) => path.includes(`/${directory}/`))).toBe(false)
    expect(paths).not.toContain('packages/service/lib/index.test.ts')
    expect(paths).not.toContain('packages/service/lib/index.spec.js')
  })

  test('walks dot-folders and dotfiles', async () => {
    const root = await makeDirectory()
    const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      '.github/workflows/deploy.yml': `env:\n  SHOPIFY_TOKEN: ${secret}\n`,
      '.vscode/settings.json': '{"editor.tabSize": 2}',
      '.eslintrc.cjs': 'module.exports = {}',
    })

    const result = await scan(root)
    const paths = hashedPaths(result)
    expect(secretFindingFiles(result)).toEqual(['.github/workflows/deploy.yml'])
    expect(paths).toContain('.vscode/settings.json')
    expect(paths).toContain('.eslintrc.cjs')

    const candidates = findSourceCandidates(listRepositoryFiles(root, DEFAULT_RULES))
    expect(candidates).toEqual([
      expect.objectContaining({path: '.eslintrc.cjs', extension: '.cjs', language: 'javascript', supported: true}),
    ])
  })

  test('excludes generated dot-folders and the .git worktree marker file', async () => {
    const root = await makeDirectory()
    const generatedDotFolders = [
      '.yarn/releases',
      '.react-router',
      '.cache',
      '.turbo',
      '.vercel',
      '.netlify',
      '.output',
      '.nuxt',
      '.svelte-kit',
      '.shopify/dev-bundle',
    ]
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      '.git': 'gitdir: /somewhere/else/.git/worktrees/app\n',
      'src/index.ts': 'export const included = true',
      ...Object.fromEntries(
        generatedDotFolders.map((directory) => [`${directory}/x.ts`, 'export const ignored = true']),
      ),
    })

    const result = await scan(root)
    const paths = hashedPaths(result)
    expect(paths).toContain('src/index.ts')
    for (const directory of generatedDotFolders) expect(paths).not.toContain(`${directory}/x.ts`)

    expect(listRepositoryFiles(root, DEFAULT_RULES)).toEqual(['shopify.app.toml', 'src/index.ts'])
  })

  test('keeps scanner-owned artifacts and atomic siblings out of stable scan inputs', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'src/index.ts': 'export const stable = true'})
    const before = await scan(root)
    await writeFiles(root, {
      '.shopify/app-security/review.json': '{"changed":true}',
      '.shopify/app-security/trace.json': '{"changed":true}',
      '.shopify/app-security/findings.json': '{"changed":true}',
    })
    const after = await scan(root)

    expect(after.scan.input_hash).toBe(before.scan.input_hash)
    expect(after.scan.file_hashes).toEqual(before.scan.file_hashes)
    expect(Object.keys(after.scan.file_hashes ?? {}).some((path) => path.includes('.shopify/app-security'))).toBe(false)
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

  test('assigns source files to every extension directory that contains them, in repository order', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      // A root-level extension configuration owns every source file in the repository.
      'shopify.extension.toml': 'type = "theme"\n',
      'index.ts': 'export const root = true',
      'extensions/alpha/shopify.extension.toml': 'type = "ui_extension"\n',
      'extensions/alpha/src/index.tsx': 'export const alpha = true',
      'extensions/alpha/nested/shopify.extension.toml': 'type = "ui_extension"\n',
      'extensions/alpha/nested/src/index.js': 'export const nested = true',
      'extensions/alpha/nested/README.md': 'not source',
      'extensions/alpha-two/shopify.extension.toml': 'type = "ui_extension"\n',
      'extensions/alpha-two/src/index.ts': 'export const alphaTwo = true',
      'extensions/beta/src/index.ts': 'export const noToml = true',
    })

    const extensions = findExtensions(root, listRepositoryFiles(root, DEFAULT_RULES))

    expect(extensions.map((extension) => [extension.path, extension.files.map((file) => file.path)])).toEqual([
      ['extensions/alpha-two/shopify.extension.toml', ['extensions/alpha-two/src/index.ts']],
      ['extensions/alpha/nested/shopify.extension.toml', ['extensions/alpha/nested/src/index.js']],
      [
        'extensions/alpha/shopify.extension.toml',
        ['extensions/alpha/nested/src/index.js', 'extensions/alpha/src/index.tsx'],
      ],
      [
        'shopify.extension.toml',
        [
          'extensions/alpha-two/src/index.ts',
          'extensions/alpha/nested/src/index.js',
          'extensions/alpha/src/index.tsx',
          'extensions/beta/src/index.ts',
          'index.ts',
        ],
      ],
    ])
    expect(extensions[2]).toMatchObject({
      path: 'extensions/alpha/shopify.extension.toml',
      type: 'ui_extension',
      content: 'type = "ui_extension"\n',
    })
    expect(extensions[2]!.files[1]).toEqual({
      path: 'extensions/alpha/src/index.tsx',
      absolutePath: join(root, 'extensions/alpha/src/index.tsx'),
      ext: '.tsx',
      content: 'export const alpha = true',
    })
  })
})

describe('gitignore-driven exclusions', () => {
  let restoreGitConfig: (() => void) | undefined
  beforeEach(() => {
    restoreGitConfig = isolateGitConfig()
  })
  afterEach(() => {
    restoreGitConfig?.()
  })

  test('excludes gitignored directories', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'tmp/\ngenerated/\n',
      'src/index.ts': 'export const included = true',
      'tmp/scratch.ts': 'export const ignored = true',
      'generated/client.ts': 'export const ignored = true',
    })

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('tmp/scratch.ts')
    expect(paths).not.toContain('generated/client.ts')
  })

  test('neither reports nor hashes a secret in a gitignored file, but does for its non-ignored twin', async () => {
    const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'notes.txt\n',
      'notes.txt': `key=${secret}\n`,
      'other.txt': `key=${secret}\n`,
    })

    const result = await scan(root)
    // The control file proves the secret is detectable, so the absence for notes.txt is not vacuous.
    expect(secretFindingFiles(result)).toEqual(['other.txt'])
    const paths = hashedPaths(result)
    expect(paths).toContain('other.txt')
    expect(paths).not.toContain('notes.txt')
  })

  test('still scans a tracked file that matches .gitignore', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'config/\n',
      'config/tracked.ts': 'export const tracked = true',
      'config/untracked.ts': 'export const untracked = true',
    })
    git(root, ['add', '-f', 'config/tracked.ts'])

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('config/tracked.ts')
    expect(paths).not.toContain('config/untracked.ts')
  })

  test('honours negation patterns', async () => {
    const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': '.env*\n!.env.example\n',
      '.env': `SHOPIFY_TOKEN=${secret}\n`,
      '.env.example': 'SHOPIFY_TOKEN=\n',
    })

    const result = await scan(root)
    const paths = hashedPaths(result)
    expect(paths).toContain('.env.example')
    expect(paths).not.toContain('.env')
    expect(secretFindingFiles(result)).toEqual([])
  })

  test('honours a nested .gitignore', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      'packages/api/.gitignore': 'local.ts\n',
      'packages/api/local.ts': 'export const ignored = true',
      'packages/api/index.ts': 'export const included = true',
      'local.ts': 'export const included = true',
    })

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('packages/api/index.ts')
    expect(paths).toContain('local.ts')
    expect(paths).not.toContain('packages/api/local.ts')
  })

  test('excludes gitignored files from an extension and from the scan hashes', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'extensions/foo/generated.js\n',
      'extensions/foo/shopify.extension.toml': 'type = "theme"\n',
      'extensions/foo/generated.js': 'export const ignored = true',
      'extensions/foo/index.js': 'export const included = true',
    })

    const extensions = findExtensions(root, listRepositoryFiles(root, await scanPathRules(root)))
    expect(extensions.map((extension) => extension.files.map((file) => file.path))).toEqual([
      ['extensions/foo/index.js'],
    ])

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('extensions/foo/index.js')
    expect(paths).not.toContain('extensions/foo/generated.js')
  })

  test('treats gitignored paths literally even when their names are gitignore-significant', async () => {
    // Glob brackets, comment `#`, negation `!` and whitespace all mean something in .gitignore
    // syntax; the names are also legal on Windows, unlike `*` or `?`.
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': '\\[id\\].ts\n\\#hash.ts\n\\!bang.ts\nsp ace.ts\n',
      '[id].ts': 'export const ignored = true',
      'id.ts': 'export const included = true',
      '#hash.ts': 'export const ignored = true',
      'hash.ts': 'export const included = true',
      '!bang.ts': 'export const ignored = true',
      'bang.ts': 'export const included = true',
      'sp ace.ts': 'export const ignored = true',
      'space.ts': 'export const included = true',
    })

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('id.ts')
    expect(paths).toContain('hash.ts')
    expect(paths).toContain('bang.ts')
    expect(paths).toContain('space.ts')
    expect(paths).not.toContain('[id].ts')
    expect(paths).not.toContain('#hash.ts')
    expect(paths).not.toContain('!bang.ts')
    expect(paths).not.toContain('sp ace.ts')
  })

  test('applies the enclosing repository .gitignore to an app in a subfolder', async () => {
    const repository = await makeRepository({
      '.gitignore': 'scratch/\n',
      'apps/web/shopify.app.toml': appConfiguration,
      'apps/web/src/index.ts': 'export const included = true',
      'apps/web/scratch/notes.ts': 'export const ignored = true',
    })

    const paths = hashedPaths(await scan(join(repository, 'apps', 'web')))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('scratch/notes.ts')
  })

  test('honours .git/info/exclude', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.git/info/exclude': 'private/\n',
      'private/keys.ts': 'export const ignored = true',
      'src/index.ts': 'export const included = true',
    })

    const paths = hashedPaths(await scan(root))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('private/keys.ts')
  })

  test('scans the whole app when the enclosing repository ignores the app folder but force-tracks a file in it', async () => {
    // Without the force-tracked README git would collapse the app to `./`; with it, git lists each
    // untracked file individually, and treating those as exclusions would empty the scan.
    const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')
    const repository = await makeRepository({
      '.gitignore': 'apps/web/\n',
      'apps/web/shopify.app.toml': appConfiguration,
      'apps/web/README.md': 'docs',
      'apps/web/.env': `SHOPIFY_TOKEN=${secret}\n`,
      'apps/web/a.ts': 'export const scanned = true',
    })
    git(repository, ['add', '-f', 'apps/web/README.md', '.gitignore'])
    git(repository, ['commit', '-qm', 'init'])

    const result = await scan(join(repository, 'apps', 'web'))
    const paths = hashedPaths(result)
    expect(paths).toContain('.env')
    expect(paths).toContain('a.ts')
    expect(secretFindingFiles(result)).toEqual(['.env'])
  })

  test('omits an ignored manifest from manifest inspection but inspects a force-tracked one', async () => {
    const manifest = JSON.stringify({dependencies: {react: '19.0.0'}})
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'tmp/\nlegacy/\n',
      'package.json': manifest,
      'tmp/package.json': manifest,
      'legacy/package.json': manifest,
      'legacy/untracked.json': '{}',
    })
    git(root, ['add', '-f', 'legacy/package.json'])

    const result = await scan(root)
    expect(inspectedManifestPaths(result)).toEqual(['legacy/package.json', 'package.json'])
    const paths = hashedPaths(result)
    expect(paths).toContain('legacy/package.json')
    expect(paths).not.toContain('tmp/package.json')
  })

  test('ignores nothing from a .gitignore outside a git repository', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'tmp/\n',
      'tmp/scratch.ts': 'export const scanned = true',
    })

    expect(hashedPaths(await scan(root))).toContain('tmp/scratch.ts')
  })

  test('loads a gitignored selected app configuration file', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'shopify.app.staging.toml\n',
      'shopify.app.staging.toml': 'name = "Staging"\napplication_url = "https://staging.example.com"\n',
    })

    const result = await scan(root, 'staging')
    expect(result.app.name).toBe('Staging')
    expect(hashedPaths(result)).toContain('shopify.app.staging.toml')
  })
})

describe('listRepositoryFiles', () => {
  test('lists a symlinked directory as an entry without traversing it', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'real/inner.ts': 'export const inner = true'})
    await symlink(join(root, 'real'), join(root, 'linked'), 'dir')

    expect(listRepositoryFiles(root, DEFAULT_RULES)).toEqual(['linked', 'real/inner.ts', 'shopify.app.toml'])
  })

  test('skips a nested app directory even when its configuration file is excluded by a rule', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'index.ts': 'export const parent = true',
      'apps/child/shopify.app.toml': 'name = "Child"\n',
      'apps/child/index.ts': 'export const child = true',
    })
    const rules = buildPathRules({gitIgnoredPaths: ['apps/child/shopify.app.toml']})

    expect(listRepositoryFiles(root, rules)).toEqual(['index.ts', 'shopify.app.toml'])
  })

  test('returns sorted app-root-relative POSIX paths', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'z.ts': '',
      'b/d.ts': '',
      'a.ts': '',
      'b/c.ts': '',
      'b/a/e.ts': '',
    })

    const files = listRepositoryFiles(root, DEFAULT_RULES)
    expect(files).toEqual(['a.ts', 'b/a/e.ts', 'b/c.ts', 'b/d.ts', 'z.ts'])
    expect(files).toEqual([...files].sort())
  })

  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'records an unreadable directory as skipped and keeps walking',
    async () => {
      const root = await makeDirectory()
      await writeFiles(root, {
        'shopify.app.toml': appConfiguration,
        'locked/secret.ts': 'export const hidden = true',
        'src/index.ts': 'export const included = true',
      })
      const locked = join(root, 'locked')
      await chmod(locked, 0o000)
      try {
        resetSkippedFiles()
        expect(listRepositoryFiles(root, DEFAULT_RULES)).toEqual(['shopify.app.toml', 'src/index.ts'])
        expect(getSkippedFiles()).toEqual([
          {path: 'locked', reason: 'unreadable', detail: 'Could not inspect locked (EACCES)'},
        ])
      } finally {
        await chmod(locked, 0o755)
      }
    },
  )

  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'names the app root when it cannot be read',
    async () => {
      const root = await makeDirectory()
      await writeFiles(root, {'shopify.app.toml': appConfiguration})
      await chmod(root, 0o000)
      try {
        resetSkippedFiles()
        expect(listRepositoryFiles(root, DEFAULT_RULES)).toEqual([])
        expect(getSkippedFiles()).toEqual([
          {path: root, reason: 'unreadable', detail: 'Could not inspect app root (EACCES)'},
        ])
      } finally {
        await chmod(root, 0o755)
      }
    },
  )
})
