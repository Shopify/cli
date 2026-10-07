/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {
  configureRepositoryReader,
  findDependencyAutomationInputs,
  findManifests,
  gatherPaths,
  getSkippedFiles,
} from '../scanners/discover.js'
import {DEPENDENCY_AUTOMATION_CONFIG_PATHS} from '../rules/dependency-automation-rules.js'
import {createPathRules} from '../scanners/path-rules.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {execFileSync} from 'node:child_process'
import {mkdir, symlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

afterEach(() => {
  vi.unstubAllEnvs()
})

function configureReader(root: string): void {
  configureRepositoryReader({appDirectory: root, scanDirectories: [root], explicitInputs: new Set()})
}

/** Gathers with Git filtering off, so the temporary directory's surroundings can't change the result. */
async function findInputs(root: string, excludePatterns: string[] = []) {
  configureReader(root)
  const {paths} = await gatherPaths({
    appDirectory: root,
    scanDirectories: [root],
    requestedScanDirectories: [root],
    rules: createPathRules({excludePatterns, noGitIgnore: true}),
  })
  return findDependencyAutomationInputs(root, paths)
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await mkdir(dirname(join(root, path)), {recursive: true})
      await writeFile(join(root, path), content)
    }),
  )
}

describe('dependency automation discovery', () => {
  test('reads only allowlisted config, preserving exact bytes and ignoring workflows', async () => {
    await inTemporaryDirectory(async (root) => {
      await expect(findInputs(root)).resolves.toEqual({files: []})
      const content = 'version: 2\r\nupdates: []\r\n'
      await writeFiles(root, {
        '.github/dependabot.yml': content,
        '.gitlab/renovate.json': '{}',
        '.github/workflows/audit.yml': 'jobs: [',
        '.gitlab-ci.yml': 'include: [',
        '.circleci/config.yml': 'jobs: [',
        '.snyk': 'version: v1.25.0',
      })
      const result = await findInputs(root)
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.files.map(({path}) => path)).toEqual(['.github/dependabot.yml'])
      expect(result.files[0]?.content).toBe(content)
    })
  })

  test.each(DEPENDENCY_AUTOMATION_CONFIG_PATHS)('discovers the allowlisted file %s', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {[path]: '{}'})
      const result = await findInputs(root)
      expect(result.files).toMatchObject([{path, content: '{}'}])
      expect(result.unresolvedReason).toBeUndefined()
    })
  })

  test('stops discovery after finding one configuration file', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'renovate.json': '{}', '.renovaterc': 'x'.repeat(500_001)})
      expect((await findInputs(root)).files).toMatchObject([{path: 'renovate.json'}])
      expect(getSkippedFiles()).toEqual([])
    })
  })

  test('reads only the paths it is given', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'renovate.json': '{}', '.github/dependabot.yml': 'version: 2\nupdates: []\n'})
      configureReader(root)
      expect(findDependencyAutomationInputs(root, ['.github/dependabot.yml']).files).toMatchObject([
        {path: '.github/dependabot.yml'},
      ])
      expect(findDependencyAutomationInputs(root, ['src/renovate.json'])).toEqual({files: []})
    })
  })

  describe('path rules', () => {
    test('treats a configuration file an exclusion matches like a missing one', async () => {
      await inTemporaryDirectory(async (root) => {
        vi.stubEnv('INIT_CWD', root)
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        await expect(findInputs(root, ['.github/dependabot.yml'])).resolves.toEqual({files: []})
        expect(getSkippedFiles()).toEqual([])
      })
    })

    test('excludes a configuration file inside a directory an exclusion matches', async () => {
      await inTemporaryDirectory(async (root) => {
        vi.stubEnv('INIT_CWD', root)
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        await expect(findInputs(root, ['.github'])).resolves.toEqual({files: []})
      })
    })

    test('continues to a later allowlisted file when an earlier one is excluded', async () => {
      await inTemporaryDirectory(async (root) => {
        vi.stubEnv('INIT_CWD', root)
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n', 'renovate.json': '{}'})
        const result = await findInputs(root, ['.github/dependabot.yml'])
        expect(result.files).toMatchObject([{path: 'renovate.json', content: '{}'}])
        expect(result.unresolvedReason).toBeUndefined()
      })
    })

    test('does not exclude a file when the exclusions only name a sibling or a lookalike', async () => {
      await inTemporaryDirectory(async (root) => {
        vi.stubEnv('INIT_CWD', root)
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        const result = await findInputs(root, ['.github/dependabot.yaml', '.github/workflows', '.githu'])
        expect(result.files).toMatchObject([{path: '.github/dependabot.yml'}])
      })
    })
  })

  test('preserves bounded reads and skipped-file coverage', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'.github/dependabot.yml': 'x'.repeat(500_001)})
      await expect(findInputs(root)).resolves.toMatchObject({
        files: [],
        unresolvedReason: expect.stringContaining('too large'),
      })
      expect(getSkippedFiles()).toEqual([
        expect.objectContaining({path: '.github/dependabot.yml', reason: 'too_large', size_bytes: 500_001}),
      ])
    })
  })

  describe('apps below the repository root', () => {
    async function writeRepositoryMarker(directory: string, marker: string): Promise<void> {
      if (marker === 'directory') await mkdir(join(directory, '.git'))
      else await writeFile(join(directory, '.git'), 'gitdir: /outside/not-read')
    }

    async function makeMonorepo(repository: string, marker: string): Promise<string> {
      const app = join(repository, 'apps', 'example')
      await mkdir(app, {recursive: true})
      await writeRepositoryMarker(repository, marker)
      return app
    }

    test.each(['directory', 'worktree file'])(
      'reads configuration at the root of a %s repository that is not scanned',
      async (marker) => {
        await inTemporaryDirectory(async (repository) => {
          const app = await makeMonorepo(repository, marker)
          await expect(findInputs(app)).resolves.toEqual({files: []})
          const content = 'version: 2\nupdates: []\n'
          await writeFiles(repository, {'.github/dependabot.yml': content})
          const result = await findInputs(app)
          expect(result.unresolvedReason).toBeUndefined()
          expect(result.files).toEqual([
            expect.objectContaining({
              path: '../../.github/dependabot.yml',
              absolutePath: join(repository, '.github/dependabot.yml'),
              content,
            }),
          ])
        })
      },
    )

    test('ignores configuration in the app directory, which bots do not read below the repository root', async () => {
      await inTemporaryDirectory(async (repository) => {
        const app = await makeMonorepo(repository, 'directory')
        await writeFiles(app, {'.github/dependabot.yml': 'version: 2\nupdates: []'})
        await expect(findInputs(app)).resolves.toEqual({files: []})
      })
    })

    test.each(['directory', 'worktree file'])(
      'keeps an app with its own %s repository inside that repository',
      async (marker) => {
        await inTemporaryDirectory(async (repository) => {
          const app = await makeMonorepo(repository, 'directory')
          await writeFiles(repository, {'.github/dependabot.yml': 'version: 2\nupdates: []'})
          await writeRepositoryMarker(app, marker)
          await expect(findInputs(app)).resolves.toEqual({files: []})
          await writeFiles(app, {'renovate.json': '{}'})
          expect((await findInputs(app)).files).toMatchObject([{path: 'renovate.json'}])
        })
      },
    )

    test('applies path rules to the repository root when it is a scan directory', async () => {
      await inTemporaryDirectory(async (repository) => {
        vi.stubEnv('INIT_CWD', repository)
        const app = await makeMonorepo(repository, 'directory')
        await writeFiles(repository, {'.github/dependabot.yml': 'version: 2\nupdates: []'})
        const findScanningRoot = async (excludePatterns: string[]) => {
          configureRepositoryReader({appDirectory: app, scanDirectories: [repository], explicitInputs: new Set()})
          const {paths} = await gatherPaths({
            appDirectory: app,
            scanDirectories: [repository],
            requestedScanDirectories: [app, repository],
            rules: createPathRules({excludePatterns, noGitIgnore: true}),
          })
          return findDependencyAutomationInputs(app, paths)
        }
        expect((await findScanningRoot([])).files).toMatchObject([{path: '../../.github/dependabot.yml'}])
        await expect(findScanningRoot(['.github'])).resolves.toEqual({files: []})
      })
    })

    test('does not follow a root configuration link that leaves the repository', async () => {
      await inTemporaryDirectory(async (repository) => {
        await inTemporaryDirectory(async (outside) => {
          const app = await makeMonorepo(repository, 'directory')
          await writeFile(join(outside, 'dependabot.yml'), 'version: 2')
          await mkdir(join(repository, '.github'))
          await symlink(join(outside, 'dependabot.yml'), join(repository, '.github/dependabot.yml'))
          const result = await findInputs(app)
          expect(result).toMatchObject({files: [], unresolvedReason: expect.stringContaining('outside')})
          expect(result.unresolvedReason).not.toContain(repository)
          expect(result.unresolvedReason).not.toContain(outside)
          expect(getSkippedFiles()).toContainEqual(
            expect.objectContaining({path: '../../.github/dependabot.yml', reason: 'unreadable'}),
          )
        })
      })
    })

    test('preserves bounded reads of root configuration', async () => {
      await inTemporaryDirectory(async (repository) => {
        const app = await makeMonorepo(repository, 'directory')
        await writeFiles(repository, {'.github/dependabot.yml': 'x'.repeat(500_001)})
        await expect(findInputs(app)).resolves.toMatchObject({
          files: [],
          unresolvedReason: expect.stringContaining('too large'),
        })
        expect(getSkippedFiles()).toEqual([
          expect.objectContaining({path: '../../.github/dependabot.yml', reason: 'too_large', size_bytes: 500_001}),
        ])
      })
    })
  })

  test.each(['.github', '.gitlab'])('does not follow a symbolic-linked %s directory', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFiles(outside, {'dependabot.yml': 'version: 2', 'renovate.json': '{}'})
        await symlink(outside, join(root, path), 'dir')
        await expect(findInputs(root)).resolves.toEqual({files: []})
        expect(getSkippedFiles()).toEqual([])
      })
    })
  })

  test('rejects an ambiguous .git link', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await symlink(outside, join(root, '.git'), 'dir')
        const result = await findInputs(root)
        expect(result).toMatchObject({files: [], unresolvedReason: expect.any(String)})
        expect(result.unresolvedReason).not.toContain(root)
        expect(result.unresolvedReason).not.toContain(outside)
      })
    })
  })

  test('rejects dangling config-file links', async () => {
    await inTemporaryDirectory(async (root) => {
      await symlink(join(root, 'missing'), join(root, 'renovate.json'))
      const result = await findInputs(root)
      expect(result.unresolvedReason).toContain('dangling symbolic link')
      expect(result.unresolvedReason).not.toContain(root)
      expect(getSkippedFiles()).toContainEqual(expect.objectContaining({path: 'renovate.json', reason: 'unreadable'}))
    })
  })

  test('keeps looking after an unsafe allowlisted path', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFile(join(outside, 'dependabot.yml'), 'version: 2')
        await mkdir(join(root, '.github'))
        await symlink(join(outside, 'dependabot.yml'), join(root, '.github/dependabot.yml'))
        await writeFiles(root, {'renovate.json': '{}'})
        const result = await findInputs(root)
        expect(result.files).toMatchObject([{path: 'renovate.json', content: '{}'}])
        expect(result.unresolvedReason).toBeUndefined()
        expect(getSkippedFiles()).toContainEqual(
          expect.objectContaining({path: '.github/dependabot.yml', reason: 'unreadable'}),
        )
      })
    })
  })

  test('rejects escaping config-file links and accepts contained ones', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFile(join(outside, 'config.json'), '{}')
        await symlink(join(outside, 'config.json'), join(root, 'renovate.json'))
        const rejected = await findInputs(root)
        expect(rejected.unresolvedReason).toContain('outside the scan directory')
        expect(rejected.unresolvedReason).not.toContain(root)
        expect(rejected.unresolvedReason).not.toContain(outside)
        expect(getSkippedFiles()).toContainEqual(expect.objectContaining({path: 'renovate.json', reason: 'unreadable'}))
        await writeFiles(root, {'.github/config.yml': 'version: 2\nupdates: []'})
        await symlink(join(root, '.github/config.yml'), join(root, '.github/dependabot.yml'))
        const result = await findInputs(root)
        expect(result.files).toMatchObject([{path: '.github/dependabot.yml'}])
        expect(result.unresolvedReason).toBeUndefined()
      })
    })
  })

  test.skipIf(process.platform === 'win32')('rejects special files without attempting to read them', async () => {
    await inTemporaryDirectory(async (root) => {
      execFileSync('mkfifo', [join(root, 'renovate.json')])
      expect((await findInputs(root)).unresolvedReason).toContain('not a file')
      execFileSync('mkfifo', [join(root, '.git')])
      expect((await findInputs(root)).unresolvedReason).toContain('repository ownership')
    })
  })
})

describe('manifest safety', () => {
  test('rejects escaped manifests and parent paths', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFile(join(outside, 'package.json'), '{"dependencies":{"react":"19.0.0"}}')
        await symlink(join(outside, 'package.json'), join(root, 'package.json'))
        configureReader(root)
        expect(findManifests(root, ['package.json', '../package.json'])).toEqual([])
        expect(getSkippedFiles()).toHaveLength(2)
      })
    })
  })

  test.each(['null', '[]', '{"dependencies":{"react":1}}', '{"devDependencies":{"vitest":null}}'])(
    'records malformed manifests as coverage gaps: %s',
    async (content) => {
      await inTemporaryDirectory(async (root) => {
        await writeFile(join(root, 'package.json'), content)
        configureReader(root)
        expect(findManifests(root, ['package.json'])).toMatchObject([{dependencies: {}, devDependencies: {}}])
        expect(getSkippedFiles()).toEqual([
          expect.objectContaining({reason: 'unreadable', detail: 'manifest could not be parsed'}),
        ])
      })
    },
  )

  test('only reads files named exactly package.json', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(join(root, 'package.json'), '{"dependencies":{"react":"19.0.0"}}')
      await writeFile(join(root, 'my-package.json'), '{"dependencies":{"left-pad":"1.0.0"}}')
      configureReader(root)
      expect(findManifests(root, ['my-package.json', 'package.json'])).toMatchObject([{path: 'package.json'}])
      expect(getSkippedFiles()).toEqual([])
    })
  })

  test('does not retain or validate package scripts for this check', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(join(root, 'package.json'), '{"scripts":{"audit":["npm audit"]}}')
      configureReader(root)
      expect(findManifests(root, ['package.json'])).toMatchObject([{dependencies: {}, devDependencies: {}}])
      expect(findManifests(root, ['package.json'])[0]).not.toHaveProperty('scripts')
      expect(getSkippedFiles()).toEqual([])
    })
  })
})
