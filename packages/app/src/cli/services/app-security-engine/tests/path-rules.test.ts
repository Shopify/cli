/* eslint-disable no-restricted-imports -- path rules are verified against real temporary git repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {
  DEFAULT_EXCLUDE_PATTERNS,
  buildPathRules,
  createFilePathMatcher,
  createPathMatcher,
  listGitIgnoredPaths,
} from '../scanners/path-rules.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {PathRules} from '../scanners/path-rules.js'

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

const DEFAULTS_ONLY: PathRules = {defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: []}

const gitIgnoredOnly = (paths: string[]): PathRules => ({defaults: [], gitIgnoredPaths: paths})

async function listedPaths(appRoot: string): Promise<string[]> {
  const listing = await listGitIgnoredPaths(appRoot)
  expect(listing.status).toBe('listed')
  return listing.status === 'listed' ? listing.paths : []
}

describe('listGitIgnoredPaths', () => {
  test('collapses a fully ignored directory to a single trailing-slash entry', async () => {
    const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': '', 'tmp/nested/b.ts': '', 'src/index.ts': ''})

    await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'listed', paths: ['tmp/']})
  })

  test('reports an ignored single file', async () => {
    const root = makeRepository({'.gitignore': 'notes.txt\n', 'notes.txt': 'todo', 'src/index.ts': ''})

    await expect(listedPaths(root)).resolves.toEqual(['notes.txt'])
  })

  test('does not report a tracked file that matches .gitignore', async () => {
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
      // Git doesn't follow symlinks, so the link is listed as a file, not a `dir/` entry.
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

      await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'not-a-repository'})
    })

    test('reports an app folder the enclosing repository ignores, even with a force-tracked descendant', async () => {
      // A force-tracked file stops git collapsing the app to `./`; it lists each file instead.
      const repository = makeRepository({
        '.gitignore': 'apps/web/\n',
        'apps/web/README.md': 'docs',
        'apps/web/.env': 'SECRET=1\n',
        'apps/web/a.ts': '',
      })
      git(repository, ['add', '-f', 'apps/web/README.md', '.gitignore'])
      git(repository, ['commit', '-qm', 'init'])

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'))).resolves.toEqual({
        status: 'app-root-ignored',
      })
    })

    test('reports an app folder whose ancestor the enclosing repository ignores', async () => {
      const repository = makeRepository({
        '.gitignore': 'apps/\n',
        'apps/web/shopify.app.toml': '',
        'apps/web/src/index.ts': '',
      })

      // Control: from the repository root, git lists the ignored folder.
      await expect(listedPaths(repository)).resolves.toEqual(['apps/'])

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'))).resolves.toEqual({
        status: 'app-root-ignored',
      })
    })

    test('does not treat the top level of a repository as ignored', async () => {
      const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})

      await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'listed', paths: ['tmp/']})
    })

    test('does not treat the top level of a whitelist-style repository as ignored', async () => {
      const root = makeRepository({
        '.gitignore': '*\n!src/\n!src/**\n!.gitignore\n',
        'src/index.ts': '',
        'tmp.log': '',
      })

      await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'listed', paths: ['tmp.log']})
    })

    test('does not treat an app folder a whitelist-style repository re-includes as ignored', async () => {
      const repository = makeRepository({
        '.gitignore': '*\n!*/\n!*.ts\n!.gitignore\n',
        'apps/web/shopify.app.toml': '',
        'apps/web/src/index.ts': '',
        'apps/web/.env': 'SECRET=1\n',
      })

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'))).resolves.toEqual({
        status: 'listed',
        paths: ['.env', 'shopify.app.toml'],
      })
    })

    test('reports a directory inside .git as not being in a repository', async () => {
      const root = makeRepository({})

      await expect(listGitIgnoredPaths(join(root, '.git'))).resolves.toEqual({status: 'not-a-repository'})
    })

    test.each([
      ['config', '[core\nbogus'],
      ['HEAD', 'not a ref'],
    ])(
      'reports a failure, not a missing repository, when git refuses a repository with a corrupt %s',
      async (file, content) => {
        // Both make `rev-parse` exit 128, as it does outside any repository.
        const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
        git(root, ['add', '.gitignore'])
        git(root, ['commit', '-qm', 'init'])
        writeFileSync(join(root, '.git', file), content)

        await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'failed'})
      },
    )

    test.skipIf(process.platform === 'win32')(
      'reports a failure, not a missing repository, when the .git marker is a dangling symlink',
      async () => {
        // A dangling `.git` link also makes `rev-parse` exit 128.
        const root = makeDirectory()
        writeFiles(root, {'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
        symlinkSync(join(root, 'missing-git-dir'), join(root, '.git'))

        await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'failed'})
      },
    )

    test('reports a failure when git refuses a repository enclosing the app folder', async () => {
      const repository = makeRepository({'apps/web/src/index.ts': ''})
      writeFileSync(join(repository, '.git', 'config'), '[core\nbogus')

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'))).resolves.toEqual({status: 'failed'})
    })

    test('reports a failure when git cannot list the working tree', async () => {
      const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
      git(root, ['add', '.gitignore'])
      git(root, ['commit', '-qm', 'init'])
      // A truncated index leaves `rev-parse` and `check-ignore --no-index` working but makes
      // `ls-files` exit with a fatal error.
      writeFileSync(join(root, '.git', 'index'), 'not an index')

      await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'failed'})
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
    const isExcluded = createPathMatcher({defaults: ['Build/'], gitIgnoredPaths: []})

    expect(isExcluded('Build/a.ts', {directory: false})).toBe(true)
    expect(isExcluded('build/a.ts', {directory: false})).toBe(false)
  })

  test('handles many gitignore literals and many lookups', () => {
    // Compiling literals into patterns instead of a Set makes this take about a minute.
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
})

describe('buildPathRules', () => {
  test('keeps the defaults and the git literals as separate phases, in input order', () => {
    expect(buildPathRules({gitIgnoredPaths: ['notes.txt', 'tmp/']})).toEqual({
      defaults: DEFAULT_EXCLUDE_PATTERNS,
      gitIgnoredPaths: ['notes.txt', 'tmp/'],
    })
  })

  test('has no git literals when git reported nothing', () => {
    expect(buildPathRules({gitIgnoredPaths: []})).toEqual({defaults: DEFAULT_EXCLUDE_PATTERNS, gitIgnoredPaths: []})
  })
})
