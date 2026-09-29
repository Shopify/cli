/* eslint-disable no-restricted-imports -- path rules are verified against real temporary git repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {
  DEFAULT_EXCLUDE_PATTERNS,
  buildPathRules,
  createFilePathMatcher,
  createPathMatcher,
  listGitIgnoredPaths,
  ignorePatternProblem,
  ignorePatternRules,
} from '../scanners/path-rules.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {PathOverride, PathRules} from '../scanners/path-rules.js'

const temporaryDirectories: string[] = []
let restoreGitConfig: (() => void) | undefined

beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})

afterEach(() => {
  restoreGitConfig?.()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, {recursive: true, force: true})
})

function makeDirectory(prefix = 'app-security-path-rules-'): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, path)
    mkdirSync(join(fullPath, '..'), {recursive: true})
    writeFileSync(fullPath, content)
  }
}

function makeRepository(files: Record<string, string>): string {
  const root = makeDirectory()
  git(root, ['init', '-q', '.'])
  writeFiles(root, files)
  return root
}

/** Only the defaults, as the matcher sees them when git reported nothing. */
const DEFAULTS_ONLY: PathRules = {defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: [], overrides: []}

/** Only git literals, so a test can prove literal matching without a default getting in the way. */
const gitIgnoredOnly = (paths: string[]): PathRules => ({defaults: [], gitIgnoredPaths: paths, overrides: []})

const cliExclude = (pattern: string): PathOverride => ({action: 'exclude', pattern, source: 'cli'})
const cliInclude = (pattern: string): PathOverride => ({action: 'include', pattern, source: 'cli'})

/** The listing options exactly as `scan()` uses them when no override can re-include a default directory. */
const PRUNED = {pruneDefaultDirectories: true}

async function listedPaths(appRoot: string, options = PRUNED): Promise<string[]> {
  const listing = await listGitIgnoredPaths(appRoot, options)
  expect(listing.status).toBe('listed')
  return listing.status === 'listed' ? listing.paths : []
}

describe('listGitIgnoredPaths', () => {
  test('collapses a fully ignored directory to a single trailing-slash entry', async () => {
    const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': '', 'tmp/nested/b.ts': '', 'src/index.ts': ''})

    await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'listed', paths: ['tmp/']})
  })

  test('reports an ignored single file', async () => {
    const root = makeRepository({'.gitignore': 'notes.txt\n', 'notes.txt': 'todo', 'src/index.ts': ''})

    await expect(listedPaths(root)).resolves.toEqual(['notes.txt'])
  })

  test('does not report a tracked file that matches .gitignore', async () => {
    // The classic leak: commit .env, then gitignore it. It must still be scanned.
    const root = makeRepository({'.gitignore': '.env\n', '.env': 'SECRET=1\n'})
    git(root, ['add', '-f', '.env'])
    git(root, ['commit', '-qm', 'oops'])

    await expect(listedPaths(root)).resolves.toEqual([])
  })

  test('honours gitignore negation', async () => {
    const root = makeRepository({'.gitignore': '.env*\n!.env.example\n', '.env': 'SECRET=1\n', '.env.example': 'X=\n'})

    await expect(listedPaths(root)).resolves.toEqual(['.env'])
  })

  test('honours a nested .gitignore and reports paths relative to the app root', async () => {
    const root = makeRepository({
      'web/.gitignore': 'generated/\n',
      'web/generated/schema.ts': '',
      'web/src/index.ts': '',
    })

    await expect(listedPaths(root)).resolves.toEqual(['web/generated/'])
  })

  test('honours .git/info/exclude', async () => {
    const root = makeRepository({'scratch.ts': '', 'src/index.ts': ''})
    writeFiles(root, {'.git/info/exclude': 'scratch.ts\n'})

    await expect(listedPaths(root)).resolves.toEqual(['scratch.ts'])
  })

  test('reports paths relative to an app nested inside a larger repository, applying the parent .gitignore', async () => {
    const repository = makeRepository({
      '.gitignore': 'tmp/\n*.log\n',
      'apps/my-app/shopify.app.toml': '',
      'apps/my-app/tmp/a.ts': '',
      'apps/my-app/debug.log': '',
      'apps/my-app/src/index.ts': '',
      'tmp/outside.ts': '',
    })

    const paths = await listedPaths(join(repository, 'apps', 'my-app'))

    expect(paths.sort()).toEqual(['debug.log', 'tmp/'])
  })

  test('reports gitignore-significant filenames literally', async () => {
    // Names that .gitignore syntax treats specially (glob brackets, comment `#`, negation `!`,
    // whitespace) yet remain legal filenames on every platform, including Windows.
    const root = makeRepository({
      '.gitignore': '\\[id\\].ts\n\\#hash.ts\n\\!bang.ts\nsp ace.ts\n',
      '[id].ts': '',
      'id.ts': '',
      '#hash.ts': '',
      'hash.ts': '',
      '!bang.ts': '',
      'bang.ts': '',
      'sp ace.ts': '',
      'space.ts': '',
    })

    const paths = await listedPaths(root)

    expect(paths.sort()).toEqual(['!bang.ts', '#hash.ts', '[id].ts', 'sp ace.ts'])
  })

  test.skipIf(process.platform === 'win32')(
    'reports an ignored symlinked directory as a file literal, without a trailing slash',
    async () => {
      // git never follows a symlink while listing, so the link is a blob to it and is not collapsed
      // to a `dir/` entry. `createFilePathMatcher` relies on this when it documents that a
      // gitignored symlinked `.github` is not excluded by the `.github/` ancestor check.
      const root = makeRepository({'.gitignore': '.github\n', 'real/dependabot.yml': ''})
      symlinkSync(join(root, 'real'), join(root, '.github'), 'dir')

      await expect(listedPaths(root)).resolves.toEqual(['.github'])
      expect(createFilePathMatcher(gitIgnoredOnly(['.github']))('.github/dependabot.yml')).toBe(false)
    },
  )

  test('is isolated from $XDG_CONFIG_HOME/git/ignore by isolateGitConfig', async () => {
    const fakeConfigHome = makeDirectory('app-security-xdg-')
    writeFiles(fakeConfigHome, {'git/ignore': 'notes.txt\n'})
    const root = makeRepository({'notes.txt': 'todo', 'src/index.ts': ''})

    // Sanity: with core.excludesFile unset git does read $XDG_CONFIG_HOME/git/ignore.
    vi.stubEnv('XDG_CONFIG_HOME', fakeConfigHome)
    await expect(listedPaths(root)).resolves.toEqual(['notes.txt'])

    const restoreAgain = isolateGitConfig()
    try {
      await expect(listedPaths(root)).resolves.toEqual([])
    } finally {
      restoreAgain()
    }
  })

  describe('outcomes other than a listing', () => {
    test('reports a directory outside any git repository', async () => {
      const root = makeDirectory()
      writeFiles(root, {'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})

      await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'not-a-repository'})
    })

    test('reports an app folder the enclosing repository ignores, even with a force-tracked descendant', async () => {
      // With a force-tracked file inside, git no longer collapses the app to a single `./` entry:
      // it lists every untracked file in the app individually, which would empty the scan.
      const repository = makeRepository({
        '.gitignore': 'apps/web/\n',
        'apps/web/README.md': 'docs',
        'apps/web/.env': 'SECRET=1\n',
        'apps/web/a.ts': '',
      })
      git(repository, ['add', '-f', 'apps/web/README.md', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'), PRUNED)).resolves.toEqual({
        status: 'app-root-ignored',
      })
    })

    test('reports an app folder whose ancestor the enclosing repository ignores', async () => {
      const repository = makeRepository({
        '.gitignore': 'apps/\n',
        'apps/web/shopify.app.toml': '',
        'apps/web/src/index.ts': '',
      })

      // Asked from the repository root the same setup lists the ignored folder, proving git works here.
      await expect(listedPaths(repository)).resolves.toEqual(['apps/'])

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'), PRUNED)).resolves.toEqual({
        status: 'app-root-ignored',
      })
    })

    test('does not treat the top level of a repository as ignored', async () => {
      const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})

      await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'listed', paths: ['tmp/']})
    })

    test('does not treat the top level of a whitelist-style repository as ignored', async () => {
      // `git check-ignore .` at the top level normalises `.` to the empty path, which a bare `*`
      // matches, so probing there would misreport the app as ignored and drop every git exclusion.
      const root = makeRepository({
        '.gitignore': '*\n!src/\n!src/**\n!.gitignore\n',
        'src/index.ts': '',
        'tmp.log': '',
      })

      await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'listed', paths: ['tmp.log']})
    })

    test('does not treat an app folder a whitelist-style repository re-includes as ignored', async () => {
      const repository = makeRepository({
        '.gitignore': '*\n!*/\n!*.ts\n!.gitignore\n',
        'apps/web/shopify.app.toml': '',
        'apps/web/src/index.ts': '',
        'apps/web/.env': 'SECRET=1\n',
      })

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'), PRUNED)).resolves.toEqual({
        status: 'listed',
        paths: ['.env', 'shopify.app.toml'],
      })
    })

    test('reports a directory inside .git as not being in a repository', async () => {
      // `git rev-parse --is-inside-work-tree` prints `false` with exit code 0 there.
      const root = makeRepository({})

      await expect(listGitIgnoredPaths(join(root, '.git'), PRUNED)).resolves.toEqual({status: 'not-a-repository'})
    })

    test.each([
      ['config', '[core\nbogus'],
      ['HEAD', 'not a ref'],
    ])(
      'reports a failure, not a missing repository, when git refuses a repository with a corrupt %s',
      async (file, content) => {
        // Both make `rev-parse` exit 128, as it does outside any repository (verified with git 2.55: a
        // corrupt config prints "bad config line", a corrupt HEAD even prints "not a git repository").
        // The .git marker on disk is what tells the two apart.
        const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
        git(root, ['add', '.gitignore'])
        git(root, ['commit', '-qm', 'init'])
        writeFileSync(join(root, '.git', file), content)

        await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'failed'})
      },
    )

    test.skipIf(process.platform === 'win32')(
      'reports a failure, not a missing repository, when the .git marker is a dangling symlink',
      async () => {
        // git cannot follow the dangling link, so `rev-parse` exits 128 exactly as it does outside any
        // repository; the ambiguous marker on disk is what keeps this from being reported as one.
        const root = makeDirectory()
        writeFiles(root, {'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
        symlinkSync(join(root, 'missing-git-dir'), join(root, '.git'))

        await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'failed'})
      },
    )

    test('reports a failure when git refuses a repository enclosing the app folder', async () => {
      const repository = makeRepository({'apps/web/src/index.ts': ''})
      writeFileSync(join(repository, '.git', 'config'), '[core\nbogus')

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'), PRUNED)).resolves.toEqual({status: 'failed'})
    })

    test('reports a failure when git cannot list the working tree', async () => {
      const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
      git(root, ['add', '.gitignore'])
      git(root, ['commit', '-qm', 'init'])
      // A truncated index leaves `rev-parse` and `check-ignore --no-index` working but makes
      // `ls-files` exit with a fatal error.
      writeFileSync(join(root, '.git', 'index'), 'not an index')

      await expect(listGitIgnoredPaths(root, PRUNED)).resolves.toEqual({status: 'failed'})
    })
  })

  describe('default directories are excluded from the git listing', () => {
    test('never lists paths inside an unignored node_modules directory', async () => {
      const root = makeRepository({
        '.gitignore': '*.log\n',
        'node_modules/pkg/index.js': '',
        'node_modules/pkg/debug.log': '',
        'packages/api/node_modules/other/error.log': '',
        'my-fixtures/sub/fixture.log': '',
        'src/index.ts': '',
        'src/app.log': '',
      })

      const paths = await listedPaths(root)

      expect(paths.some((path) => path.includes('node_modules'))).toBe(false)
      expect(paths.some((path) => path.includes('my-fixtures'))).toBe(false)
      expect(paths).toEqual(['src/app.log'])
    })

    test('still lists an ignored file inside a folder that is not a default exclusion', async () => {
      const root = makeRepository({
        '.gitignore': '*.log\n',
        'scratch/notes.log': '',
        'scratch/keep.ts': '',
        'node_modules/pkg/debug.log': '',
        'node_modules/pkg/index.js': '',
      })

      await expect(listedPaths(root)).resolves.toEqual(['scratch/notes.log'])
    })

    test('lists paths inside the default directories when pruning is off', async () => {
      // `scan()` turns pruning off whenever an include override exists, since a re-included default
      // directory is walked and the git-ignored files inside it must still be excluded.
      const root = makeRepository({
        '.gitignore': '*.log\n',
        'node_modules/pkg/index.js': '',
        'node_modules/pkg/debug.log': '',
        'src/index.ts': '',
        'src/app.log': '',
      })

      await expect(listedPaths(root)).resolves.toEqual(['src/app.log'])
      await expect(listedPaths(root, {pruneDefaultDirectories: false})).resolves.toEqual([
        'node_modules/pkg/debug.log',
        'src/app.log',
      ])
    })
  })
})

describe('gitIgnoredPaths', () => {
  test('excludes exactly the reported path, never a sibling, whatever characters it contains', () => {
    const cases: {path: string; siblings: string[]}[] = [
      {path: 'q?.ts', siblings: ['qx.ts', 'q.ts', 'sub/q?.ts']},
      {path: '[id].ts', siblings: ['id.ts', 'i.ts', 'sub/[id].ts']},
      {path: 'a*b.ts', siblings: ['axb.ts', 'ab.ts', 'sub/a*b.ts']},
      {path: '#hash.ts', siblings: ['hash.ts', 'sub/#hash.ts']},
      {path: '!bang.ts', siblings: ['bang.ts', 'sub/!bang.ts']},
      {path: 'sp ace.ts', siblings: ['space.ts', 'sub/sp ace.ts']},
      {path: 'back\\slash.ts', siblings: ['backslash.ts', 'sub/back\\slash.ts']},
      {path: 'line\nbreak.ts', siblings: ['linebreak.ts', 'line', 'break.ts']},
      {path: 'carriage\rreturn.ts', siblings: ['carriagereturn.ts']},
    ]

    for (const {path, siblings} of cases) {
      const isExcluded = createPathMatcher(gitIgnoredOnly([path]))
      expect(isExcluded(path, {directory: false}), `${JSON.stringify(path)} should be excluded`).toBe(true)
      for (const sibling of siblings) {
        expect(
          isExcluded(sibling, {directory: false}),
          `${JSON.stringify(sibling)} should not be excluded by ${JSON.stringify(path)}`,
        ).toBe(false)
      }
    }
  })

  test('matches a collapsed directory entry as a directory only', () => {
    // Contents of `tmp/` are never asked about: the walker prunes the excluded directory.
    const isExcluded = createPathMatcher(gitIgnoredOnly(['tmp/']))

    expect(isExcluded('tmp', {directory: true})).toBe(true)
    expect(isExcluded('tmp', {directory: false})).toBe(false)
    expect(isExcluded('src/tmp.ts', {directory: false})).toBe(false)
    expect(isExcluded('src/tmp', {directory: true})).toBe(false)
  })

  test('matches a file entry as a file only', () => {
    const isExcluded = createPathMatcher(gitIgnoredOnly(['notes.txt']))

    expect(isExcluded('notes.txt', {directory: false})).toBe(true)
    expect(isExcluded('notes.txt', {directory: true})).toBe(false)
    expect(isExcluded('sub/notes.txt', {directory: false})).toBe(false)
  })

  test('applies alongside the defaults', () => {
    const isExcluded = createPathMatcher(buildPathRules({gitIgnoredPaths: ['notes.txt', 'tmp/']}))

    expect(isExcluded('notes.txt', {directory: false})).toBe(true)
    expect(isExcluded('tmp', {directory: true})).toBe(true)
    expect(isExcluded('node_modules', {directory: true})).toBe(true)
    expect(isExcluded('src/index.ts', {directory: false})).toBe(false)
  })
})

describe('DEFAULT_EXCLUDE_PATTERNS', () => {
  const isExcluded = createPathMatcher(DEFAULTS_ONLY)

  test('excludes every default directory at the root and at any depth', () => {
    const directories = [
      'node_modules',
      'vendor',
      '.next',
      'coverage',
      'dist',
      'build',
      '.shopify',
      'test',
      'tests',
      'spec',
      'specs',
      '__tests__',
      'fixtures',
      'my-fixtures',
      '__fixtures__',
      '.yarn',
      '.react-router',
      '.cache',
      '.turbo',
      '.vercel',
      '.netlify',
      '.output',
      '.nuxt',
      '.svelte-kit',
    ]

    for (const directory of directories) {
      expect(isExcluded(directory, {directory: true}), `${directory}/ at root`).toBe(true)
      expect(isExcluded(`packages/a/${directory}`, {directory: true}), `nested ${directory}/`).toBe(true)
      expect(isExcluded(`${directory}/index.ts`, {directory: false}), `file inside ${directory}/`).toBe(true)
    }
  })

  test('excludes .git as both a directory and the file used by git worktrees', () => {
    expect(isExcluded('.git', {directory: true})).toBe(true)
    expect(isExcluded('.git', {directory: false})).toBe(true)
    expect(isExcluded('packages/a/.git', {directory: false})).toBe(true)
  })

  test('excludes test files and fixture directories by pattern', () => {
    expect(isExcluded('a.test.ts', {directory: false})).toBe(true)
    expect(isExcluded('src/a.spec.tsx', {directory: false})).toBe(true)
    expect(isExcluded('my-fixtures/x.ts', {directory: false})).toBe(true)
  })

  test('does not exclude source, environment files, or CI and editor configuration', () => {
    const scannable = [
      '.github/workflows/ci.yml',
      '.vscode/settings.json',
      '.devcontainer/devcontainer.json',
      '.circleci/config.yml',
      '.env',
      'src/index.ts',
      '.eslintrc.cjs',
      'testing/helpers.ts',
      'src/builder.ts',
    ]

    for (const path of scannable) {
      expect(isExcluded(path, {directory: false}), `${path} should be scanned`).toBe(false)
    }
  })

  test('does not throw for names made only of dots', () => {
    expect(isExcluded('...', {directory: false})).toBe(false)
    expect(isExcluded('src/...', {directory: false})).toBe(false)
    expect(isExcluded('...', {directory: true})).toBe(false)
  })
})

describe('createPathMatcher', () => {
  test('is case sensitive', () => {
    const isExcluded = createPathMatcher({defaults: ['Build/'], gitIgnoredPaths: [], overrides: []})

    expect(isExcluded('Build/a.ts', {directory: false})).toBe(true)
    expect(isExcluded('build/a.ts', {directory: false})).toBe(false)
  })

  describe('with overrides', () => {
    test('an include re-includes a gitignored directory and, as it is no longer pruned, its contents', () => {
      const isExcluded = createPathMatcher({
        defaults: DEFAULT_EXCLUDE_PATTERNS,
        gitIgnoredPaths: ['tmp/'],
        overrides: [cliInclude('tmp/')],
      })

      expect(isExcluded('tmp', {directory: true})).toBe(false)
      expect(isExcluded('tmp/a.ts', {directory: false})).toBe(false)
    })

    test('an include for one file inside a gitignored directory does not re-include the directory', () => {
      // git collapses the ignored directory to a single `tmp/` literal, which the walker prunes
      // before ever asking about `tmp/keep.ts`; users must re-include the directory itself.
      const isExcluded = createPathMatcher({
        defaults: DEFAULT_EXCLUDE_PATTERNS,
        gitIgnoredPaths: ['tmp/'],
        overrides: [cliInclude('tmp/keep.ts')],
      })

      expect(isExcluded('tmp', {directory: true})).toBe(true)
    })

    test('an exclude wins over the defaults, the git literals and an earlier include', () => {
      const isExcluded = createPathMatcher({
        defaults: DEFAULT_EXCLUDE_PATTERNS,
        gitIgnoredPaths: ['notes.txt'],
        overrides: [cliInclude('keep.ts'), cliExclude('keep.ts'), cliExclude('*.md'), cliExclude('generated/')],
      })

      expect(isExcluded('keep.ts', {directory: false})).toBe(true)
      expect(isExcluded('README.md', {directory: false})).toBe(true)
      expect(isExcluded('docs/guide.md', {directory: false})).toBe(true)
      expect(isExcluded('generated', {directory: true})).toBe(true)
      expect(isExcluded('web/generated', {directory: true})).toBe(true)
      expect(isExcluded('notes.txt', {directory: false})).toBe(true)
      expect(isExcluded('node_modules', {directory: true})).toBe(true)
      expect(isExcluded('src/index.ts', {directory: false})).toBe(false)
    })

    test('an include re-includes a default exclusion without touching other defaults', () => {
      const isExcluded = createPathMatcher({
        defaults: DEFAULT_EXCLUDE_PATTERNS,
        gitIgnoredPaths: ['notes.txt'],
        overrides: [cliInclude('web/build/')],
      })

      expect(isExcluded('web/build', {directory: true})).toBe(false)
      expect(isExcluded('web/build/a.ts', {directory: false})).toBe(false)
      expect(isExcluded('build/a.ts', {directory: false})).toBe(true)
      expect(isExcluded('notes.txt', {directory: false})).toBe(true)
    })

    test('a default that matches a file inside a re-included directory still excludes it', () => {
      const isExcluded = createPathMatcher({
        defaults: DEFAULT_EXCLUDE_PATTERNS,
        gitIgnoredPaths: ['notes.txt'],
        overrides: [cliInclude('web/build/')],
      })

      expect(isExcluded('web/build/a.test.ts', {directory: false})).toBe(true)
    })

    test('the defaults and the git literals decide when no override matches', () => {
      const isExcluded = createPathMatcher({
        defaults: ['*.log'],
        gitIgnoredPaths: ['notes.txt'],
        overrides: [cliInclude('other.ts')],
      })

      expect(isExcluded('debug.log', {directory: false})).toBe(true)
      expect(isExcluded('notes.txt', {directory: false})).toBe(true)
      expect(isExcluded('other.ts', {directory: false})).toBe(false)
      expect(isExcluded('src/index.ts', {directory: false})).toBe(false)
    })
  })

  describe('with --ignore patterns', () => {
    // The matcher semantics are covered above with `PathOverride` values and the `!` and escape
    // parsing under `ignorePatternRules`; this only pins that command-line order is rule order.
    test('later CLI patterns win over earlier ones', () => {
      const fromPatterns = (ignorePatterns: string[]) =>
        createPathMatcher(buildPathRules({gitIgnoredPaths: [], overrides: ignorePatternRules(ignorePatterns)}))
      const excludeThenInclude = fromPatterns(['generated/', '!generated/'])
      const includeThenExclude = fromPatterns(['!generated/', 'generated/'])

      expect(excludeThenInclude('generated', {directory: true})).toBe(false)
      expect(includeThenExclude('generated', {directory: true})).toBe(true)
    })
  })

  test('handles many gitignore literals and many lookups', () => {
    // 50,000 literals × 50,000 lookups. The literal lookup is a Set membership test, which keeps
    // this far inside vitest's timeout; compiling the literals into patterns (as the first version
    // of this matcher did) made the same workload take about a minute.
    const rules = buildPathRules({
      gitIgnoredPaths: Array.from({length: 50_000}, (_, index) => `dir${index % 100}/.DS_Store${index}`),
    })
    const isExcluded = createPathMatcher(rules)
    const paths = Array.from({length: 50_000}, (_, index) => `src/module${index % 500}/file${index}.ts`)

    let excluded = 0
    for (const path of paths) if (isExcluded(path, {directory: false})) excluded += 1

    expect(excluded).toBe(0)
    expect(isExcluded('dir7/.DS_Store7', {directory: false})).toBe(true)
    expect(isExcluded('dir7/.DS_Store', {directory: false})).toBe(false)
  })
})

describe('createFilePathMatcher', () => {
  test('tests a root-level file against the rules directly', () => {
    const isExcluded = createFilePathMatcher(gitIgnoredOnly(['.env']))

    expect(isExcluded('.env')).toBe(true)
    expect(isExcluded('.env.example')).toBe(false)
  })

  test('excludes a file below a collapsed git directory literal', () => {
    // `createPathMatcher` alone would answer false for `tmp/a/b.ts`: the literal `tmp/` names only the
    // directory. This matcher asks about the ancestors first, as the walker's pruning would have.
    const isExcluded = createFilePathMatcher(gitIgnoredOnly(['tmp/']))

    expect(isExcluded('tmp/a/b.ts')).toBe(true)
  })

  test('does not exclude a sibling whose name merely starts with an excluded directory', () => {
    const isExcluded = createFilePathMatcher(gitIgnoredOnly(['tmp/']))

    expect(isExcluded('tmpx/a.ts')).toBe(false)
  })

  test('excludes a file below a default pattern directory at any depth', () => {
    const isExcluded = createFilePathMatcher(DEFAULTS_ONLY)

    expect(isExcluded('packages/web/node_modules/dep/index.js')).toBe(true)
    expect(isExcluded('packages/web/src/index.js')).toBe(false)
  })

  test('lets an include override re-include a git file literal', () => {
    const isExcluded = createFilePathMatcher({
      defaults: [],
      gitIgnoredPaths: ['.github/dependabot.yml'],
      overrides: [cliInclude('.github/dependabot.yml')],
    })

    expect(isExcluded('.github/dependabot.yml')).toBe(false)
  })

  test('lets an exclude override exclude a file the defaults and git would keep', () => {
    const isExcluded = createFilePathMatcher({defaults: [], gitIgnoredPaths: [], overrides: [cliExclude('.github/')]})

    expect(isExcluded('.github/dependabot.yml')).toBe(true)
    expect(isExcluded('renovate.json')).toBe(false)
  })
})

describe('ignorePatternRules', () => {
  test('turns a plain line into a CLI exclude rule and a `!` line into a CLI include rule', () => {
    expect(ignorePatternRules(['generated/', '!build/', '*.log', '/docs'])).toEqual([
      cliExclude('generated/'),
      cliInclude('build/'),
      cliExclude('*.log'),
      cliExclude('/docs'),
    ])
  })

  test('passes gitignore escapes through unchanged so `\\!` excludes a literal `!` name', () => {
    const overrides = ignorePatternRules(['\\!bang.ts', '\\#hash.ts'])
    expect(overrides).toEqual([cliExclude('\\!bang.ts'), cliExclude('\\#hash.ts')])

    const isExcluded = createPathMatcher({defaults: [], gitIgnoredPaths: [], overrides})
    expect(isExcluded('!bang.ts', {directory: false})).toBe(true)
    expect(isExcluded('bang.ts', {directory: false})).toBe(false)
    expect(isExcluded('#hash.ts', {directory: false})).toBe(true)
  })

  test('returns no rules for no patterns', () => {
    expect(ignorePatternRules([])).toEqual([])
  })

  test('rejects a value the flag layer should already have refused as a bug', () => {
    // A lone `!` would make `ignore` re-include every path, so it must never reach the matcher.
    expect(() => ignorePatternRules(['!'])).toThrow(BugError)
    expect(() => ignorePatternRules(['!'])).toThrow(/nothing after/)
    expect(() => ignorePatternRules([''])).toThrow(/empty/)
  })
})

describe('ignorePatternProblem', () => {
  test('accepts ordinary .gitignore lines', () => {
    for (const value of [
      'generated/',
      '!build/',
      '*.log',
      '/docs',
      '\\#hash.ts',
      '\\!bang.ts',
      'a b/',
      '!.env',
      'build\\\\',
      'build\\\\\\\\',
      'trailing\\ ',
      'app/[id]/x.ts',
    ]) {
      expect(ignorePatternProblem(value), value).toBeUndefined()
    }
  })

  test('rejects empty and whitespace-only values', () => {
    expect(ignorePatternProblem('')).toMatch(/empty/)
    expect(ignorePatternProblem('   ')).toMatch(/empty/)
  })

  test('rejects a .gitignore comment and suggests escaping the #', () => {
    const problem = ignorePatternProblem('#hash.ts')
    expect(problem).toMatch(/comment/)
    expect(problem).toContain('\\#')
  })

  test('rejects a `!` with nothing to re-include', () => {
    expect(ignorePatternProblem('!')).toMatch(/nothing after/)
    expect(ignorePatternProblem('!  ')).toMatch(/nothing after/)
  })

  test('rejects a trailing unescaped backslash, which `ignore` would silently drop or fail to compile', () => {
    for (const value of ['build\\', 'src\\lib\\', '!build\\', '\\', 'build\\\\\\', '!build\\\\\\\\\\', '\\\\\\']) {
      const problem = ignorePatternProblem(value)
      expect(problem, value).toMatch(/ends with a backslash/)
      expect(problem, value).toContain('/')
      expect(problem, value).toContain('\\\\')
    }
  })

  test('rejects values that span more than one line', () => {
    for (const value of ['build/\ngenerated/', 'build/\r\n', 'build/\r', '\nbuild/']) {
      expect(ignorePatternProblem(value), JSON.stringify(value)).toMatch(/single line/)
    }
  })

  test('rejects patterns with `..` as a whole path segment', () => {
    for (const value of ['..', '../x', 'x/..', 'a/../b', '**/../x', '!../shared/']) {
      expect(ignorePatternProblem(value), value).toBe(
        `The --ignore pattern "${value}" contains "..". Patterns are relative to the app directory and can't point outside it.`,
      )
    }
  })

  test('rejects patterns the `ignore` matcher cannot compile, instead of crashing the scan', () => {
    for (const value of ['src/[id/x.ts', '![/', 'a\\\\[b', 'a\\\\(b']) {
      expect(ignorePatternProblem(value), value).toBe(
        `The --ignore pattern "${value}" can't be read as a .gitignore pattern. Check for an unclosed "[" or a backslash before a special character.`,
      )
      expect(() => ignorePatternRules([value]), value).toThrow(BugError)
    }
  })

  test('allows patterns where dots are part of a path segment', () => {
    for (const value of ['..cache/', 'a..b', '...', 'x/..y']) {
      expect(ignorePatternProblem(value), value).toBeUndefined()
    }
  })
})

describe('buildPathRules', () => {
  test('keeps the defaults, the git literals and the overrides as separate phases, in input order', () => {
    const overrides = [cliExclude('generated/'), cliInclude('build/')]

    expect(buildPathRules({gitIgnoredPaths: ['notes.txt', 'tmp/'], overrides})).toEqual({
      defaults: DEFAULT_EXCLUDE_PATTERNS,
      gitIgnoredPaths: ['notes.txt', 'tmp/'],
      overrides,
    })
  })

  test('has no git literals and no overrides when neither was supplied', () => {
    const expected = {defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: [], overrides: []}
    expect(buildPathRules({gitIgnoredPaths: []})).toEqual(expected)
    expect(buildPathRules({gitIgnoredPaths: [], overrides: []})).toEqual(expected)
  })
})
