/* eslint-disable no-restricted-imports -- path rules are verified against real temporary git repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {
  createPathRules,
  isDroppedEntry,
  isDroppedTrackedPath,
  isIgnoredByParentRepository,
  listGitIgnoredPaths,
  listNestedRepository,
  listTrackedFiles,
  repositoryIgnoredPaths,
} from '../scanners/path-rules.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

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
  const directory = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
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

function commitAll(root: string): void {
  git(root, ['add', '-A'])
  git(root, ['commit', '-qm', 'init'])
}

async function listedPaths(directory: string): Promise<string[]> {
  const listing = await listGitIgnoredPaths(directory)
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

  test('does not exclude node_modules or any other directory by name', async () => {
    const root = makeRepository({
      '.gitignore': '*.log\n',
      'node_modules/pkg/index.js': '',
      'node_modules/pkg/debug.log': '',
      'src/index.ts': '',
      'src/app.log': '',
    })

    await expect(listedPaths(root)).resolves.toEqual(['node_modules/pkg/debug.log', 'src/app.log'])
  })

  test('honours gitignore negation', async () => {
    const root = makeRepository({'.gitignore': '.env*\n!.env.example\n', '.env': 'SECRET=1\n', '.env.example': 'X=\n'})

    await expect(listedPaths(root)).resolves.toEqual(['.env'])
  })

  test('honours a nested .gitignore and reports paths relative to the listed directory', async () => {
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

  test('reports paths relative to a directory nested inside a larger repository, applying the parent .gitignore', async () => {
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
        commitAll(root)
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

    test('reports a failure when git refuses a repository enclosing the directory', async () => {
      const repository = makeRepository({'apps/web/src/index.ts': ''})
      writeFileSync(join(repository, '.git', 'config'), '[core\nbogus')

      await expect(listGitIgnoredPaths(join(repository, 'apps', 'web'))).resolves.toEqual({status: 'failed'})
    })

    test('reports a failure when git cannot list the working tree', async () => {
      const root = makeRepository({'.gitignore': 'tmp/\n', 'tmp/a.ts': ''})
      git(root, ['add', '.gitignore'])
      git(root, ['commit', '-qm', 'init'])
      // A truncated index leaves `rev-parse` working but makes `ls-files` exit with a fatal error.
      writeFileSync(join(root, '.git', 'index'), 'not an index')

      await expect(listGitIgnoredPaths(root)).resolves.toEqual({status: 'failed'})
    })
  })
})

describe('isIgnoredByParentRepository', () => {
  test('is true for a directory that the repository containing its parent ignores', async () => {
    const repository = makeRepository({'.gitignore': 'dist/\n', 'dist/a.js': '', 'src/a.ts': ''})

    await expect(isIgnoredByParentRepository(join(repository, 'dist'))).resolves.toBe(true)
    await expect(isIgnoredByParentRepository(join(repository, 'src'))).resolves.toBe(false)
  })

  test('is true even when a file in the directory is force-tracked', async () => {
    const repository = makeRepository({'.gitignore': 'dist/\n', 'dist/a.js': '', 'dist/b.js': ''})
    git(repository, ['add', '-f', 'dist/a.js', '.gitignore'])
    git(repository, ['commit', '-qm', 'init'])

    await expect(isIgnoredByParentRepository(join(repository, 'dist'))).resolves.toBe(true)
  })

  test('is true for a directory whose ancestor the repository ignores', async () => {
    const repository = makeRepository({'.gitignore': 'apps/\n', 'apps/web/src/index.ts': ''})

    await expect(isIgnoredByParentRepository(join(repository, 'apps', 'web'))).resolves.toBe(true)
  })

  test("is true for a nested repository's top level that the outer repository ignores", async () => {
    const outer = makeRepository({'.gitignore': 'inner/\n'})
    const inner = join(outer, 'inner')
    mkdirSync(inner)
    git(inner, ['init', '-q', '.'])

    await expect(isIgnoredByParentRepository(inner)).resolves.toBe(true)
  })

  test('is false when the directory is the top level of its own repository and nothing ignores it', async () => {
    const repository = makeRepository({'src/a.ts': ''})

    await expect(isIgnoredByParentRepository(repository)).resolves.toBe(false)
  })

  test("is false when the parent isn't in a repository", async () => {
    const root = makeDirectory()
    writeFiles(root, {'.gitignore': 'app/\n', 'app/a.ts': ''})

    await expect(isIgnoredByParentRepository(join(root, 'app'))).resolves.toBe(false)
  })

  test('is false for a directory whose name starts with a dash', async () => {
    const repository = makeRepository({'-odd/a.ts': ''})

    await expect(isIgnoredByParentRepository(join(repository, '-odd'))).resolves.toBe(false)
  })
})

describe('listTrackedFiles', () => {
  test('lists only the files git tracks in the directory, relative to it', async () => {
    const repository = makeRepository({
      '.gitignore': 'dist/\n',
      'apps/web/src/a.ts': '',
      'apps/web/dist/b.js': '',
      'apps/web/untracked.ts': '',
      'other/c.ts': '',
    })
    git(repository, ['add', '-f', 'apps/web/src/a.ts', 'apps/web/dist/b.js', 'other/c.ts'])
    git(repository, ['commit', '-qm', 'init'])

    await expect(listTrackedFiles(join(repository, 'apps', 'web'))).resolves.toEqual(['dist/b.js', 'src/a.ts'])
  })

  test('is undefined outside a repository', async () => {
    const root = makeDirectory()

    await expect(listTrackedFiles(root)).resolves.toBeUndefined()
  })
})

describe('listNestedRepository', () => {
  test('is undefined for a directory without a .git entry', async () => {
    const root = makeRepository({'src/a.ts': ''})

    await expect(listNestedRepository(join(root, 'src'))).resolves.toBeUndefined()
  })

  test('lists the repository whose top level is the directory, using its own ignore rules', async () => {
    const outer = makeRepository({'.gitignore': 'outer-only.ts\n'})
    const inner = join(outer, 'inner')
    writeFiles(inner, {'.gitignore': 'inner-only.ts\n', 'inner-only.ts': '', 'outer-only.ts': ''})
    git(inner, ['init', '-q', '.'])

    await expect(listNestedRepository(inner)).resolves.toEqual({status: 'listed', paths: ['inner-only.ts']})
  })

  test('lists a submodule, whose .git is a file', async () => {
    const submodule = makeRepository({'.gitignore': 'generated/\n', 'generated/a.ts': '', 'a.ts': ''})
    commitAll(submodule)
    const outer = makeRepository({})
    git(outer, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', submodule, 'vendor/sub'])
    writeFiles(join(outer, 'vendor', 'sub'), {'generated/a.ts': ''})

    await expect(listNestedRepository(join(outer, 'vendor', 'sub'))).resolves.toEqual({
      status: 'listed',
      paths: ['generated/'],
    })
  })

  test.skipIf(process.platform === 'win32')('is failed when .git is a symbolic link', async () => {
    const outer = makeRepository({})
    const inner = join(outer, 'inner')
    const target = makeRepository({})
    mkdirSync(inner)
    symlinkSync(join(target, '.git'), join(inner, '.git'), 'dir')

    await expect(listNestedRepository(inner)).resolves.toEqual({status: 'failed'})
  })
})

describe('path rules', () => {
  const noGitFiltering = {gitFiltering: false, excludePatterns: [], workingDirectory: '/work'}

  test('drops an entry named .git, a directory or a worktree file, at any depth, when Git filtering is on', () => {
    const rules = {gitFiltering: true, excludePatterns: [], workingDirectory: '/work'}

    expect(isDroppedEntry(rules, undefined, {absolutePath: '/work/.git', isDirectory: true})).toBe(true)
    expect(isDroppedEntry(rules, undefined, {absolutePath: '/work/packages/a/.git', isDirectory: false})).toBe(true)
    expect(isDroppedEntry(rules, undefined, {absolutePath: '/work/.github', isDirectory: true})).toBe(false)
    expect(isDroppedEntry(noGitFiltering, undefined, {absolutePath: '/work/.git', isDirectory: true})).toBe(false)
  })

  test("drops what the entry's own repository lists as ignored, keyed by the repository directory", () => {
    const rules = {gitFiltering: true, excludePatterns: [], workingDirectory: '/work'}
    const outer = repositoryIgnoredPaths('/work', {status: 'listed', paths: ['dist/', 'notes.txt']})
    const inner = repositoryIgnoredPaths('/work/inner', {status: 'listed', paths: ['build/']})

    expect(isDroppedEntry(rules, outer, {absolutePath: '/work/dist', isDirectory: true})).toBe(true)
    expect(isDroppedEntry(rules, outer, {absolutePath: '/work/notes.txt', isDirectory: false})).toBe(true)
    expect(isDroppedEntry(rules, outer, {absolutePath: '/work/src/notes.txt', isDirectory: false})).toBe(false)
    // A directory entry never matches a file of the same name.
    expect(isDroppedEntry(rules, outer, {absolutePath: '/work/dist', isDirectory: false})).toBe(false)
    expect(isDroppedEntry(rules, inner, {absolutePath: '/work/inner/build', isDirectory: true})).toBe(true)
    expect(isDroppedEntry(rules, inner, {absolutePath: '/work/inner/dist', isDirectory: true})).toBe(false)
  })

  test('applies no repository rules when Git filtering is off or the repository has no listing', () => {
    const outer = repositoryIgnoredPaths('/work', {status: 'listed', paths: ['dist/']})

    expect(isDroppedEntry(noGitFiltering, outer, {absolutePath: '/work/dist', isDirectory: true})).toBe(false)
    expect(repositoryIgnoredPaths('/work', {status: 'failed'})).toBeUndefined()
    expect(repositoryIgnoredPaths('/work', {status: 'not-a-repository'})).toBeUndefined()
  })

  describe('--exclude', () => {
    function rulesFor(workingDirectory: string, excludePatterns: string[], gitFiltering = true) {
      vi.stubEnv('INIT_CWD', workingDirectory)
      return createPathRules({excludePatterns, noGitIgnore: !gitFiltering})
    }

    test('matches a bare name only at the top of the working directory', () => {
      const working = makeDirectory()
      const rules = rulesFor(working, ['generated'])

      expect(isDroppedEntry(rules, undefined, {absolutePath: join(working, 'generated'), isDirectory: true})).toBe(true)
      expect(isDroppedEntry(rules, undefined, {absolutePath: join(working, 'src/generated'), isDirectory: true})).toBe(
        false,
      )
    })

    test('matches a name at any depth with **/', () => {
      const working = makeDirectory()
      const rules = rulesFor(working, ['**/generated'])

      expect(isDroppedEntry(rules, undefined, {absolutePath: join(working, 'generated'), isDirectory: true})).toBe(true)
      expect(
        isDroppedEntry(rules, undefined, {absolutePath: join(working, 'src/a/generated'), isDirectory: true}),
      ).toBe(true)
      expect(
        isDroppedEntry(rules, undefined, {absolutePath: join(working, 'src/generated.ts'), isDirectory: false}),
      ).toBe(false)
    })

    test('matches a path outside the working directory with ../', () => {
      const parent = makeDirectory()
      const working = join(parent, 'app')
      mkdirSync(working)
      const rules = rulesFor(working, ['../backend/**'])

      expect(
        isDroppedEntry(rules, undefined, {absolutePath: join(parent, 'backend/src/a.ts'), isDirectory: false}),
      ).toBe(true)
      expect(
        isDroppedEntry(rules, undefined, {absolutePath: join(parent, 'frontend/src/a.ts'), isDirectory: false}),
      ).toBe(false)
    })

    test.each([
      ['./src', 'src'],
      ['src/', 'src'],
      ['../app/src', 'src'],
      ['./src/**', 'src/**'],
      ['.', ''],
      ['../app', ''],
      ['../backend/**', '../backend/**'],
      ['**/generated', '**/generated'],
      ['!src', '!src'],
      ['apps/\\[child\\]', 'apps/\\[child\\]'],
    ])('resolves the literal start of %j against the working directory, giving %j', (pattern, expected) => {
      const working = join(makeDirectory(), 'app')
      mkdirSync(working)

      expect(rulesFor(working, [pattern]).excludePatterns).toEqual([expected])
    })

    test('resolves an absolute pattern against the working directory and drops an empty one', () => {
      const working = join(makeDirectory(), 'app')
      mkdirSync(working)

      expect(rulesFor(working, [join(working, 'src', '*.ts'), '']).excludePatterns).toEqual(['src/*.ts'])
    })

    test('applies with --no-git-ignore too', () => {
      const working = makeDirectory()
      const rules = rulesFor(working, ['generated'], false)

      expect(rules.gitFiltering).toBe(false)
      expect(isDroppedEntry(rules, undefined, {absolutePath: join(working, 'generated'), isDirectory: true})).toBe(true)
    })

    test('is relative to the real path of the working directory', () => {
      const real = makeDirectory()
      const link = join(makeDirectory(), 'link')
      symlinkSync(real, link, 'dir')
      const rules = rulesFor(link, ['generated'])

      expect(rules.workingDirectory).toBe(real)
      expect(isDroppedEntry(rules, undefined, {absolutePath: join(real, 'generated'), isDirectory: true})).toBe(true)
    })
  })

  describe('tracked paths', () => {
    test('are dropped by .git and --exclude at any depth of the path, never by repository ignore rules', () => {
      const working = makeDirectory()
      vi.stubEnv('INIT_CWD', working)
      const rules = createPathRules({excludePatterns: ['generated'], noGitIgnore: false})

      expect(isDroppedTrackedPath(rules, working, 'generated/a.ts')).toBe(true)
      expect(isDroppedTrackedPath(rules, working, 'vendor/.git/config')).toBe(true)
      expect(isDroppedTrackedPath(rules, working, 'dist/a.js')).toBe(false)
    })
  })
})
