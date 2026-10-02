/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {scanDirectory as scan} from './scan-directory.js'
import {
  configureRepositoryReader,
  findExtensions,
  findSourceCandidates,
  gatherPaths,
  getSkippedFiles,
} from '../scanners/discover.js'
import {createPathRules} from '../scanners/path-rules.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {ScanResult} from '../types.js'

const temporaryDirectories: string[] = []
const appConfiguration = 'name = "Discovery safety"\napplication_url = "https://example.com"\n'
const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')

let restoreGitConfig: (() => void) | undefined

beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})

afterEach(async () => {
  restoreGitConfig?.()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

/** The real path, which is what the CLI's resolver gives the engine and what `--exclude` is matched against. */
async function makeDirectory(prefix = 'app-security-discovery-'): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  temporaryDirectories.push(directory)
  return directory
}

/** Every project-relative path the scan reports as detected source or as inspected by a check. */
function scannedPaths(result: ScanResult): string[] {
  return [
    ...new Set([
      ...result.detection.languages.flatMap((language) => language.files),
      ...result.scan.checks_executed.flatMap((execution) => execution.inspected_files),
    ]),
  ].sort()
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

interface GatherOptions {
  appDirectory?: string
  scanDirectories?: string[]
  /** Defaults to `scanDirectories`. */
  requestedScanDirectories?: string[]
  selectedAppConfigFilePath?: string
  excludePatterns?: string[]
  noGitIgnore?: boolean
}

/** Gathers the way a scan does, and leaves the reader configured for the finders. */
async function gather(root: string, options: GatherOptions = {}) {
  const appDirectory = options.appDirectory ?? root
  const scanDirectories = options.scanDirectories ?? [root]
  configureRepositoryReader({
    appDirectory,
    scanDirectories,
    explicitInputs: new Set(options.selectedAppConfigFilePath ? [options.selectedAppConfigFilePath] : []),
  })
  return gatherPaths({
    appDirectory,
    scanDirectories,
    requestedScanDirectories: options.requestedScanDirectories ?? scanDirectories,
    selectedAppConfigFilePath: options.selectedAppConfigFilePath,
    rules: createPathRules({excludePatterns: options.excludePatterns ?? [], noGitIgnore: options.noGitIgnore ?? false}),
  })
}

async function gatheredPaths(root: string, options: GatherOptions = {}): Promise<string[]> {
  return (await gather(root, options)).paths
}

async function makeSubmodule(): Promise<string> {
  const submodule = await makeRepository({'.gitignore': 'generated/\n', 'a.ts': 'export const a = true'})
  git(submodule, ['add', '-A'])
  git(submodule, ['commit', '-qm', 'init'])
  const outer = await makeRepository({'.gitignore': '*.log\n', 'index.ts': 'export const outer = true'})
  git(outer, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', submodule, 'vendor/sub'])
  await writeFiles(join(outer, 'vendor', 'sub'), {'generated/b.ts': '', 'x.log': ''})
  return outer
}

describe('gathering without a default exclusion list', () => {
  test('scans a nested app and every other file, since no name is excluded', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'parent.ts': 'export const parent = true',
      'apps/child/shopify.app.toml': 'name = "Child"\n',
      'apps/child/app/routes/child.ts': 'export const child = true',
    })

    const result = await scan(root)
    expect(scannedPaths(result)).toEqual(expect.arrayContaining(['parent.ts', 'apps/child/app/routes/child.ts']))
    await expect(gatheredPaths(root)).resolves.toContain('apps/child/shopify.app.toml')
  })

  test('scans node_modules, build output and test directories outside a repository', async () => {
    const root = await makeDirectory()
    const directories = [
      'node_modules',
      'vendor',
      'coverage',
      'dist',
      'build',
      'test',
      'tests',
      '__tests__',
      '.shopify',
    ]
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'src/index.test.ts': 'export const test = true',
      ...Object.fromEntries(directories.map((directory) => [`${directory}/x.ts`, 'export const scanned = true'])),
    })

    await expect(gatheredPaths(root)).resolves.toEqual(
      ['shopify.app.toml', 'src/index.test.ts', ...directories.map((directory) => `${directory}/x.ts`)].sort(),
    )
  })

  test('scans node_modules inside a repository when Git does not ignore it', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': '*.log\n',
      'node_modules/pkg/index.js': 'export const dependency = true',
    })

    await expect(gatheredPaths(root)).resolves.toContain('node_modules/pkg/index.js')
  })

  test('walks dot-folders and dotfiles', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      '.github/workflows/deploy.yml': `env:\n  SHOPIFY_TOKEN: ${secret}\n`,
      '.vscode/settings.json': '{"editor.tabSize": 2}',
      '.eslintrc.cjs': 'module.exports = {}',
    })

    const result = await scan(root)
    const paths = scannedPaths(result)
    expect(secretFindingFiles(result)).toEqual(['.github/workflows/deploy.yml'])
    expect(paths).toContain('.vscode/settings.json')
    expect(paths).toContain('.eslintrc.cjs')

    const candidates = findSourceCandidates(await gatheredPaths(root))
    expect(candidates).toEqual([
      expect.objectContaining({path: '.eslintrc.cjs', extension: '.cjs', language: 'javascript', supported: true}),
    ])
  })

  test('keeps the results directory out of the scan because .shopify/.gitignore ignores it', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      'src/index.ts': 'export const stable = true',
      '.shopify/.gitignore': '*\n',
    })
    const before = await scan(root)
    await writeFiles(root, {
      '.shopify/app-security/shopify.app/deterministic-findings.json': '{"changed":true}',
      '.shopify/app-security/shopify.app/agent-checks.json': '{"changed":true}',
      '.shopify/app-security/shopify.app/agent-findings.json': '{"changed":true}',
    })
    const after = await scan(root)

    expect(scannedPaths(after)).toEqual(scannedPaths(before))
    await expect(gatheredPaths(root)).resolves.toEqual(['shopify.app.toml', 'src/index.ts'])
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
    const paths = scannedPaths(result)

    expect(result.capabilities.theme_app_extension).toBe(true)
    expect(paths).toEqual(
      expect.arrayContaining(['configured/blocks/configured.liquid', 'unconfigured/blocks/unconfigured.liquid']),
    )
  })

  test('assigns source files to every extension directory that contains them, in repository order', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
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

    const extensions = findExtensions(root, await gatheredPaths(root))

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
      // Discovery joins with cli-kit, which uses `/` on every platform.
      absolutePath: joinPath(root, 'extensions/alpha/src/index.tsx'),
      ext: '.tsx',
      content: 'export const alpha = true',
    })
  })
})

describe('.git entries', () => {
  test('skips a .git directory at any depth with Git filtering on, and walks it with --no-git-ignore', async () => {
    const root = await makeRepository({'shopify.app.toml': appConfiguration, 'src/index.ts': ''})

    await expect(gatheredPaths(root)).resolves.toEqual(['shopify.app.toml', 'src/index.ts'])
    const walked = await gatheredPaths(root, {noGitIgnore: true})
    expect(walked).toContain('.git/HEAD')
    expect(walked).toContain('shopify.app.toml')
  })

  test("skips a worktree's .git file with Git filtering on, and walks it with --no-git-ignore", async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      '.git': 'gitdir: /somewhere/else/.git/worktrees/app\n',
      'packages/api/.git': 'gitdir: /somewhere/else/.git/worktrees/api\n',
      'src/index.ts': 'export const included = true',
    })

    await expect(gatheredPaths(root)).resolves.toEqual(['shopify.app.toml', 'src/index.ts'])
    await expect(gatheredPaths(root, {noGitIgnore: true})).resolves.toEqual([
      '.git',
      'packages/api/.git',
      'shopify.app.toml',
      'src/index.ts',
    ])
  })

  test('does not run Git for gathering with --no-git-ignore', async () => {
    const root = await makeRepository({'.gitignore': 'dist/\n', 'shopify.app.toml': appConfiguration, 'dist/a.ts': ''})

    const result = await gather(root, {noGitIgnore: true})

    expect(result.paths).toContain('dist/a.ts')
    expect(result.ignoredScanDirectories).toEqual([])
    expect(result.listingStatus).toBe('git-ignore-off')
  })
})

describe('repositories', () => {
  test('skips an ignored, untracked dist/ and keeps a tracked file in it', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'dist/\n',
      'dist/tracked.ts': 'export const tracked = true',
      'dist/untracked.ts': 'export const untracked = true',
      'build/untracked.ts': 'export const scanned = true',
    })
    git(root, ['add', '-f', 'dist/tracked.ts'])

    const paths = await gatheredPaths(root)
    expect(paths).toContain('dist/tracked.ts')
    expect(paths).not.toContain('dist/untracked.ts')
    expect(paths).toContain('build/untracked.ts')
  })

  test('excludes gitignored directories', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'tmp/\ngenerated/\n',
      'src/index.ts': 'export const included = true',
      'tmp/scratch.ts': 'export const ignored = true',
      'generated/client.ts': 'export const ignored = true',
    })

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('tmp/scratch.ts')
    expect(paths).not.toContain('generated/client.ts')
  })

  test('neither reports nor scans a secret in a gitignored file, but does for its non-ignored twin', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'notes.txt\n',
      'notes.txt': `key=${secret}\n`,
      'other.txt': `key=${secret}\n`,
    })

    const result = await scan(root)
    // The control file proves the secret is detectable, so the absence for notes.txt is not vacuous.
    expect(secretFindingFiles(result)).toEqual(['other.txt'])
    const paths = scannedPaths(result)
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

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('config/tracked.ts')
    expect(paths).not.toContain('config/untracked.ts')
  })

  test('honours negation patterns', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': '.env*\n!.env.example\n',
      '.env': `SHOPIFY_TOKEN=${secret}\n`,
      '.env.example': 'SHOPIFY_TOKEN=\n',
    })

    const result = await scan(root)
    const paths = scannedPaths(result)
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

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('packages/api/index.ts')
    expect(paths).toContain('local.ts')
    expect(paths).not.toContain('packages/api/local.ts')
  })

  test('excludes gitignored files from an extension and from the scan', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'extensions/foo/generated.js\n',
      'extensions/foo/shopify.extension.toml': 'type = "theme"\n',
      'extensions/foo/generated.js': 'export const ignored = true',
      'extensions/foo/index.js': 'export const included = true',
    })

    const extensions = findExtensions(root, await gatheredPaths(root))
    expect(extensions.map((extension) => extension.files.map((file) => file.path))).toEqual([
      ['extensions/foo/index.js'],
    ])

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('extensions/foo/index.js')
    expect(paths).not.toContain('extensions/foo/generated.js')
  })

  test('treats gitignored paths literally even when their names are gitignore-significant', async () => {
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

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('id.ts')
    expect(paths).toContain('hash.ts')
    expect(paths).toContain('bang.ts')
    expect(paths).toContain('space.ts')
    expect(paths).not.toContain('[id].ts')
    expect(paths).not.toContain('#hash.ts')
    expect(paths).not.toContain('!bang.ts')
    expect(paths).not.toContain('sp ace.ts')
  })

  test('applies the enclosing repository .gitignore to an app in a subdirectory', async () => {
    const repository = await makeRepository({
      '.gitignore': 'scratch/\n',
      'apps/web/shopify.app.toml': appConfiguration,
      'apps/web/src/index.ts': 'export const included = true',
      'apps/web/scratch/notes.ts': 'export const ignored = true',
    })

    const paths = scannedPaths(await scan(join(repository, 'apps', 'web')))
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

    const paths = scannedPaths(await scan(root))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('private/keys.ts')
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
    const paths = scannedPaths(result)
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

    expect(scannedPaths(await scan(root))).toContain('tmp/scratch.ts')
  })

  test('loads and scans a gitignored selected app configuration file for secrets', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'shopify.app.staging.toml\n',
      'shopify.app.staging.toml': `name = "Staging"\napplication_url = "https://staging.example.com/?token=${secret}"\n`,
    })

    const result = await scan(root, 'staging')
    expect(result.app.name).toBe('Staging')
    expect(scannedPaths(result)).toContain('shopify.app.staging.toml')
    expect(secretFindingFiles(result)).toEqual(['shopify.app.staging.toml'])
  })

  describe('nested repositories', () => {
    async function makeNestedRepository(files: {outer?: Record<string, string>; inner: Record<string, string>}) {
      const outer = await makeRepository({'shopify.app.toml': appConfiguration, ...files.outer})
      const inner = join(outer, 'inner')
      await writeFiles(inner, files.inner)
      git(inner, ['init', '-q', '.'])
      return {outer, inner}
    }

    test("applies a nested repository's own .gitignore inside it, and not the outer repository's", async () => {
      const {outer} = await makeNestedRepository({
        outer: {'.gitignore': 'outer-only.ts\n', 'outer-only.ts': ''},
        inner: {'.gitignore': 'inner-only.ts\n', 'inner-only.ts': '', 'outer-only.ts': '', 'kept.ts': ''},
      })

      const paths = await gatheredPaths(outer)
      expect(paths).not.toContain('outer-only.ts')
      expect(paths).not.toContain('inner/inner-only.ts')
      expect(paths).toEqual(expect.arrayContaining(['inner/outer-only.ts', 'inner/kept.ts']))
    })

    test('applies a nested repository rule that the outer listing would otherwise reach, such as a directory', async () => {
      const {outer} = await makeNestedRepository({
        inner: {'.gitignore': 'build/\n', 'build/a.ts': '', 'node_modules/b.ts': ''},
      })

      const paths = await gatheredPaths(outer)
      expect(paths).not.toContain('inner/build/a.ts')
      expect(paths).toContain('inner/node_modules/b.ts')
    })

    test.each([
      ['inner', 'inner/'],
      ['scratch/deep', 'scratch/'],
    ])('prunes nested repository %s when the app repository ignores %s', async (nestedRepository, ignoredPath) => {
      const root = await makeRepository({
        'shopify.app.toml': appConfiguration,
        '.gitignore': `${ignoredPath}\n`,
        [`${nestedRepository}/token.ts`]: `export const token = '${secret}'\n`,
        'plain/token.ts': `export const token = '${secret}'\n`,
      })
      for (const repository of [nestedRepository, 'plain']) {
        const directory = join(root, repository)
        git(directory, ['init', '-q', '.'])
        git(directory, ['add', 'token.ts'])
        git(directory, ['commit', '-qm', 'Add token'])
      }

      const result = await scan(root)
      // The unignored nested repository proves the secret is detectable, so the absence is not vacuous.
      expect(secretFindingFiles(result)).toEqual(['plain/token.ts'])
      expect(scannedPaths(result)).not.toContain(`${nestedRepository}/token.ts`)
    })

    test("walks a nested repository's ignored directory with --no-git-ignore", async () => {
      const {outer} = await makeNestedRepository({
        outer: {'.gitignore': 'inner/\n'},
        inner: {'.gitignore': 'build/\n', 'build/a.ts': '', 'kept.ts': ''},
      })

      const paths = await gatheredPaths(outer, {noGitIgnore: true})
      expect(paths).toEqual(expect.arrayContaining(['inner/build/a.ts', 'inner/kept.ts']))
    })

    test('treats a symbolic-linked .git as a failed listing: no repository exclusions, but the link itself is skipped', async () => {
      const outer = await makeRepository({
        'shopify.app.toml': appConfiguration,
        '.gitignore': 'inner-link-target-only.ts\n',
      })
      const target = await makeRepository({})
      const inner = join(outer, 'inner')
      await writeFiles(inner, {'inner-link-target-only.ts': '', 'kept.ts': ''})
      await symlink(join(target, '.git'), join(inner, '.git'), 'dir')

      const paths = await gatheredPaths(outer)
      expect(paths).toEqual(expect.arrayContaining(['inner/inner-link-target-only.ts', 'inner/kept.ts']))
      expect(paths.some((path) => path.startsWith('inner/.git'))).toBe(false)
    })

    test('applies a submodule’s own rules and not the outer repository’s', async () => {
      const outer = await makeSubmodule()

      const paths = await gatheredPaths(outer)
      expect(paths).toEqual(expect.arrayContaining(['index.ts', 'vendor/sub/a.ts', 'vendor/sub/x.log', '.gitmodules']))
      expect(paths).not.toContain('vendor/sub/generated/b.ts')
      expect(paths.some((path) => path === 'vendor/sub/.git')).toBe(false)
    })
  })

  describe('a scan directory that its repository ignores', () => {
    test('gathers only the files Git tracks there, and reports it', async () => {
      const repository = await makeRepository({
        '.gitignore': 'apps/web/\n',
        'apps/web/shopify.app.toml': appConfiguration,
        'apps/web/README.md': 'docs',
        'apps/web/.env': `SHOPIFY_TOKEN=${secret}\n`,
        'apps/web/a.ts': 'export const untracked = true',
      })
      git(repository, ['add', '-f', 'apps/web/README.md', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])
      const app = join(repository, 'apps', 'web')

      const result = await gather(app)
      expect(result.paths).toEqual(['README.md'])
      expect(result.ignoredScanDirectories).toEqual([app])
    })

    test('aborts instead of walking the directory when Git cannot list the files it tracks', async () => {
      const repository = await makeRepository({
        '.gitignore': 'apps/web/\n',
        'apps/web/shopify.app.toml': appConfiguration,
        'apps/web/.env': `SHOPIFY_TOKEN=${secret}\n`,
      })
      git(repository, ['add', '-f', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])
      // A corrupt index makes `ls-files --cached` fail while `check-ignore --no-index` still answers.
      await writeFile(join(repository, '.git', 'index'), 'not an index')
      const app = join(repository, 'apps', 'web')

      vi.stubEnv('INIT_CWD', repository)
      await expect(gather(app)).rejects.toThrow("Couldn't list the files Git tracks in apps/web.")
      vi.stubEnv('INIT_CWD', app)
      await expect(gather(app)).rejects.toThrow("Couldn't list the files Git tracks in ..")
    })

    test('scans the tracked files and not the untracked ones, and keeps the selected TOML', async () => {
      const repository = await makeRepository({
        '.gitignore': 'apps/web/\n',
        'apps/web/shopify.app.toml': appConfiguration,
        'apps/web/tracked.ts': 'export const tracked = true',
        'apps/web/.env': `SHOPIFY_TOKEN=${secret}\n`,
        'apps/web/untracked.ts': 'export const untracked = true',
      })
      git(repository, ['add', '-f', 'apps/web/tracked.ts', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])

      const result = await scan(join(repository, 'apps', 'web'))
      expect(scannedPaths(result)).toContain('tracked.ts')
      expect(scannedPaths(result)).not.toContain('untracked.ts')
      expect(secretFindingFiles(result)).toEqual([])
      expect(result.ignoredScanDirectories).toEqual([join(repository, 'apps', 'web')])
      expect(result.app.name).toBe('Discovery safety')
    })

    test('detects an ignored directory whose ancestor the repository ignores', async () => {
      const repository = await makeRepository({'.gitignore': 'apps/\n', 'apps/web/shopify.app.toml': appConfiguration})
      const app = join(repository, 'apps', 'web')

      const result = await gather(app)
      expect(result.paths).toEqual([])
      expect(result.ignoredScanDirectories).toEqual([app])
    })

    test("detects a nested repository's top level that the outer repository ignores, and gathers its tracked files", async () => {
      const outer = await makeRepository({'.gitignore': 'inner/\n', 'shopify.app.toml': appConfiguration})
      const inner = join(outer, 'inner')
      await writeFiles(inner, {'tracked.ts': 'export const tracked = true', 'untracked.ts': ''})
      git(inner, ['init', '-q', '.'])
      git(inner, ['add', 'tracked.ts'])
      git(inner, ['commit', '-qm', 'init'])

      const result = await gather(outer, {scanDirectories: [outer, inner]})
      expect(result.paths).toEqual(['.gitignore', 'inner/tracked.ts', 'shopify.app.toml'])
      expect(result.ignoredScanDirectories).toEqual([inner])
    })

    test('still applies --exclude to the tracked files, and is not ignored with --no-git-ignore', async () => {
      const repository = await makeRepository({
        '.gitignore': 'app/\n',
        'app/keep.ts': '',
        'app/generated/skip.ts': '',
        'app/untracked.ts': '',
      })
      git(repository, ['add', '-f', 'app/keep.ts', 'app/generated/skip.ts', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])
      const app = join(repository, 'app')
      vi.stubEnv('INIT_CWD', app)

      await expect(gatheredPaths(app, {excludePatterns: ['generated']})).resolves.toEqual(['keep.ts'])
      const everything = await gather(app, {noGitIgnore: true})
      expect(everything.paths).toEqual(['generated/skip.ts', 'keep.ts', 'untracked.ts'])
      expect(everything.ignoredScanDirectories).toEqual([])
    })

    test('does not treat a directory that a whitelist-style repository re-includes as ignored', async () => {
      const repository = await makeRepository({
        '.gitignore': '/*\n!/apps/\n/apps/*\n!/apps/web/\n',
        'apps/web/shopify.app.toml': appConfiguration,
        'apps/web/a.ts': '',
      })
      const app = join(repository, 'apps', 'web')

      const result = await gather(app)
      expect(result.ignoredScanDirectories).toEqual([])
      expect(result.paths).toEqual(['a.ts', 'shopify.app.toml'])
    })
  })
})

describe('--exclude', () => {
  async function makeApp(): Promise<string> {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'src/index.ts': 'export const included = true',
      'generated/client.ts': 'export const excluded = true',
      'web/generated/schema.ts': 'export const excluded = true',
    })
    vi.stubEnv('INIT_CWD', root)
    return root
  }

  test('with a bare name matches only at the top of the working directory', async () => {
    const root = await makeApp()

    const paths = scannedPaths(await scan(root, undefined, {excludePatterns: ['generated']}))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('generated/client.ts')
    expect(paths).toContain('web/generated/schema.ts')
  })

  test('with **/ matches at any depth', async () => {
    const root = await makeApp()

    const paths = scannedPaths(await scan(root, undefined, {excludePatterns: ['**/generated']}))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('generated/client.ts')
    expect(paths).not.toContain('web/generated/schema.ts')
  })

  test('with ../ matches paths above the working directory', async () => {
    const parent = await makeDirectory()
    await writeFiles(parent, {
      'app/shopify.app.toml': appConfiguration,
      'app/src/index.ts': 'export const included = true',
      'backend/src/server.ts': 'export const excluded = true',
      'backend/keep/server.ts': 'export const included = true',
    })
    vi.stubEnv('INIT_CWD', join(parent, 'app'))

    const paths = await gatheredPaths(parent, {
      appDirectory: join(parent, 'app'),
      excludePatterns: ['../backend/src/**'],
    })
    expect(paths).toEqual(['../backend/keep/server.ts', 'src/index.ts', 'shopify.app.toml'].sort())
  })

  test('applies with --no-git-ignore', async () => {
    const root = await makeApp()

    const paths = await gatheredPaths(root, {excludePatterns: ['**/generated'], noGitIgnore: true})
    expect(paths).toEqual(['shopify.app.toml', 'src/index.ts'])
  })

  test("can't remove the selected app configuration file", async () => {
    const root = await makeApp()
    const selected = join(root, 'shopify.app.toml')

    const withoutSelected = await gatheredPaths(root, {excludePatterns: ['shopify.app.toml']})
    expect(withoutSelected).not.toContain('shopify.app.toml')
    const withSelected = await gatheredPaths(root, {
      excludePatterns: ['shopify.app.toml'],
      selectedAppConfigFilePath: selected,
    })
    expect(withSelected).toContain('shopify.app.toml')

    const result = await scan(root, undefined, {excludePatterns: ['shopify.app.toml', '**/*.toml']})
    expect(result.app.name).toBe('Discovery safety')
  })

  test('still scans an excluded selected app configuration file for secrets', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'shopify.app.toml': appConfiguration,
      'shopify.app.test.toml': `name = "Test"\napplication_url = "https://test.example.com/?token=${secret}"\n`,
    })
    vi.stubEnv('INIT_CWD', root)

    const result = await scan(root, 'test', {excludePatterns: ['shopify.app.test.toml']})
    expect(result.app.name).toBe('Test')
    expect(secretFindingFiles(result)).toEqual(['shopify.app.test.toml'])
  })

  test('adds a gitignored selected app configuration file after filtering', async () => {
    const root = await makeRepository({
      'shopify.app.toml': appConfiguration,
      '.gitignore': 'shopify.app.toml\n',
    })

    const paths = await gatheredPaths(root, {selectedAppConfigFilePath: join(root, 'shopify.app.toml')})
    expect(paths).toEqual(['.gitignore', 'shopify.app.toml'])
  })
})

describe('symbolic links', () => {
  test('reads a symbolic-linked selected app configuration file that points outside the app directory', async () => {
    const root = await makeDirectory()
    const outside = await makeDirectory()
    await writeFiles(outside, {
      'real.toml': `name = "Linked"\napplication_url = "https://linked.example.com/?token=${secret}"\n`,
    })
    await symlink(join(outside, 'real.toml'), join(root, 'shopify.app.toml'))

    const result = await scan(root)
    expect(result.app.name).toBe('Linked')
    expect(secretFindingFiles(result)).toEqual(['shopify.app.toml'])
    expect(result.scan.files_skipped_count).toBe(0)
  })

  test('refuses another symbolic link that points outside the app directory', async () => {
    const root = await makeDirectory()
    const outside = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'src/index.ts': 'export const included = true'})
    await writeFiles(outside, {'leak.ts': 'export const leaked = true'})
    await symlink(join(outside, 'leak.ts'), join(root, 'src', 'leak.ts'))

    const result = await scan(root)
    expect(result.scan.files_skipped).toContainEqual(
      expect.objectContaining({
        path: 'src/leak.ts',
        reason: 'unreadable',
        detail: 'src/leak.ts resolves outside the scan directory',
      }),
    )
    expect(JSON.stringify(result)).not.toContain(outside)
  })

  test('reads a symbolic link that stays inside the scan directory', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'src/real.ts': 'export const real = true'})
    await symlink(join(root, 'src', 'real.ts'), join(root, 'src', 'alias.ts'))

    const result = await scan(root)
    expect(scannedPaths(result)).toEqual(expect.arrayContaining(['src/alias.ts', 'src/real.ts']))
    expect(result.scan.files_skipped_count).toBe(0)
  })
})

describe('gatherPaths', () => {
  test('lists a symbolic-linked directory as an entry without traversing it', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'shopify.app.toml': appConfiguration, 'real/inner.ts': 'export const inner = true'})
    await symlink(join(root, 'real'), join(root, 'linked'), 'dir')

    await expect(gatheredPaths(root)).resolves.toEqual(['linked', 'real/inner.ts', 'shopify.app.toml'])
  })

  test('returns sorted, unique, app-directory-relative POSIX paths', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'z.ts': '',
      'b/d.ts': '',
      'a.ts': '',
      'b/c.ts': '',
      'b/a/e.ts': '',
    })

    const files = await gatheredPaths(root, {selectedAppConfigFilePath: join(root, 'a.ts')})
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
        await expect(gatheredPaths(root)).resolves.toEqual(['shopify.app.toml', 'src/index.ts'])
        expect(getSkippedFiles()).toEqual([
          {path: 'locked', reason: 'unreadable', detail: 'Could not inspect locked (EACCES)'},
        ])
      } finally {
        await chmod(locked, 0o755)
      }
    },
  )

  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'names the scan directory when it cannot be read',
    async () => {
      const root = await makeDirectory()
      await writeFiles(root, {'shopify.app.toml': appConfiguration})
      await chmod(root, 0o000)
      try {
        await expect(gatheredPaths(root, {noGitIgnore: true})).resolves.toEqual([])
        expect(getSkippedFiles()).toEqual([
          {path: root, reason: 'unreadable', detail: 'Could not inspect scan directory (EACCES)'},
        ])
      } finally {
        await chmod(root, 0o755)
      }
    },
  )
})
