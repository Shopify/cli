/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {
  findDependencyAutomationInputs,
  findManifests,
  getSkippedFiles,
  resetSkippedFiles,
} from '../scanners/discover.js'
import {DEPENDENCY_AUTOMATION_CONFIG_PATHS} from '../rules/dependency-automation-rules.js'
import {buildPathRules} from '../scanners/path-rules.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {afterEach, describe, expect, test} from 'vitest'
import {execFileSync} from 'node:child_process'
import {mkdir, symlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

afterEach(() => resetSkippedFiles())

/** The defaults alone, as the scan's rules are when git reported no ignored paths. */
const NO_GIT_EXCLUSIONS = buildPathRules({gitIgnoredPaths: []})

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
      expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)).toEqual({files: []})
      const content = 'version: 2\r\nupdates: []\r\n'
      await writeFiles(root, {
        '.github/dependabot.yml': content,
        '.gitlab/renovate.json': '{}',
        '.github/workflows/audit.yml': 'jobs: [',
        '.gitlab-ci.yml': 'include: [',
        '.circleci/config.yml': 'jobs: [',
        '.snyk': 'version: v1.25.0',
      })
      const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.files.map(({path}) => path)).toEqual(['.github/dependabot.yml'])
      expect(result.files[0]?.content).toBe(content)
    })
  })

  test.each(DEPENDENCY_AUTOMATION_CONFIG_PATHS)('discovers the allowlisted file %s', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {[path]: '{}'})
      const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
      expect(result.files).toMatchObject([{path, content: '{}'}])
      expect(result.unresolvedReason).toBeUndefined()
    })
  })

  test('stops discovery after finding one configuration file', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'renovate.json': '{}', '.renovaterc': 'x'.repeat(500_001)})
      expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS).files).toMatchObject([{path: 'renovate.json'}])
      expect(getSkippedFiles()).toEqual([])
    })
  })

  describe('path rules', () => {
    test('treats a configuration file the rules exclude like a missing one', async () => {
      await inTemporaryDirectory(async (root) => {
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        const rules = buildPathRules({gitIgnoredPaths: ['.github/dependabot.yml']})
        expect(findDependencyAutomationInputs(root, rules)).toEqual({files: []})
        expect(getSkippedFiles()).toEqual([])
      })
    })

    test('excludes a configuration file inside a directory the rules exclude', async () => {
      // Git collapses a fully ignored directory to `.github/`, which never names the file itself, so the
      // decision must consider the file's ancestors.
      await inTemporaryDirectory(async (root) => {
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        const rules = buildPathRules({gitIgnoredPaths: ['.github/']})
        expect(findDependencyAutomationInputs(root, rules)).toEqual({files: []})
      })
    })

    test('continues to a later allowlisted file when an earlier one is excluded', async () => {
      await inTemporaryDirectory(async (root) => {
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n', 'renovate.json': '{}'})
        const rules = buildPathRules({gitIgnoredPaths: ['.github/dependabot.yml']})
        const result = findDependencyAutomationInputs(root, rules)
        expect(result.files).toMatchObject([{path: 'renovate.json', content: '{}'}])
        expect(result.unresolvedReason).toBeUndefined()
      })
    })

    test('applies the default patterns as well as the git literals', async () => {
      // No shipped default matches an allowlisted path (`.git` does not match `.github`), so a custom
      // default proves the phase is consulted at all.
      await inTemporaryDirectory(async (root) => {
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        expect(findDependencyAutomationInputs(root, {defaults: ['.github/'], gitIgnoredPaths: []})).toEqual({files: []})
        expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS).files).toHaveLength(1)
      })
    })

    test('does not exclude a file when the rules only name a sibling or a lookalike', async () => {
      await inTemporaryDirectory(async (root) => {
        await writeFiles(root, {'.github/dependabot.yml': 'version: 2\nupdates: []\n'})
        const rules = buildPathRules({gitIgnoredPaths: ['.github/dependabot.yaml', '.github/workflows/', '.githu/']})
        expect(findDependencyAutomationInputs(root, rules).files).toMatchObject([{path: '.github/dependabot.yml'}])
      })
    })

    test('leaves an unsafe allowlisted path unresolved when the rules do not exclude it', async () => {
      await inTemporaryDirectory(async (root) => {
        await symlink(join(root, 'missing'), join(root, '.github'), 'dir')
        const rules = buildPathRules({gitIgnoredPaths: ['renovate.json']})
        expect(findDependencyAutomationInputs(root, rules).unresolvedReason).toContain('dangling symbolic link')
      })
    })
  })

  test('preserves bounded reads and skipped-file coverage', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'.github/dependabot.yml': 'x'.repeat(500_001)})
      expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)).toMatchObject({
        files: [],
        unresolvedReason: expect.stringContaining('too large'),
      })
      expect(getSkippedFiles()).toEqual([
        expect.objectContaining({path: '.github/dependabot.yml', reason: 'too_large', size_bytes: 500_001}),
      ])
    })
  })

  test.each(['directory', 'worktree file'])('respects repository %s boundaries', async (marker) => {
    await inTemporaryDirectory(async (repository) => {
      const app = join(repository, 'apps', 'example')
      await writeFiles(app, {'.github/dependabot.yml': 'version: 2\nupdates: []'})
      if (marker === 'directory') await mkdir(join(repository, '.git'))
      else await writeFile(join(repository, '.git'), 'gitdir: /outside/not-read')
      const nested = findDependencyAutomationInputs(app, NO_GIT_EXCLUSIONS)
      expect(nested).toMatchObject({
        files: [],
        unresolvedReason: 'App root is nested below a parent Git repository',
      })
      expect(nested.unresolvedReason).not.toContain(repository)
      if (marker === 'directory') await mkdir(join(app, '.git'))
      else await writeFile(join(app, '.git'), 'gitdir: /outside/not-read')
      expect(findDependencyAutomationInputs(app, NO_GIT_EXCLUSIONS).files).toMatchObject([
        {path: '.github/dependabot.yml'},
      ])
    })
  })

  test.each(['.github', '.gitlab', '.git'])('rejects escaping or ambiguous %s directory links', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await symlink(outside, join(root, path), 'dir')
        const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
        expect(result).toMatchObject({
          files: [],
          unresolvedReason: expect.any(String),
        })
        expect(result.unresolvedReason).not.toContain(root)
        expect(result.unresolvedReason).not.toContain(outside)
      })
    })
  })

  test('rejects dangling directory links', async () => {
    await inTemporaryDirectory(async (root) => {
      await symlink(join(root, 'missing'), join(root, '.github'), 'dir')
      const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
      expect(result.unresolvedReason).toContain('dangling symbolic link')
      expect(result.unresolvedReason).not.toContain(root)
      expect(getSkippedFiles()).toContainEqual(
        expect.objectContaining({path: '.github/dependabot.yml', reason: 'unreadable'}),
      )
    })
  })

  test('keeps looking after an unsafe allowlisted path', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await symlink(outside, join(root, '.github'), 'dir')
        await writeFiles(root, {'renovate.json': '{}'})
        const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
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
        const rejected = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
        expect(rejected.unresolvedReason).toContain('outside the app root')
        expect(rejected.unresolvedReason).not.toContain(root)
        expect(rejected.unresolvedReason).not.toContain(outside)
        expect(getSkippedFiles()).toContainEqual(expect.objectContaining({path: 'renovate.json', reason: 'unreadable'}))
        await writeFiles(root, {'.github/config.yml': 'version: 2\nupdates: []'})
        await symlink(join(root, '.github/config.yml'), join(root, '.github/dependabot.yml'))
        const result = findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS)
        expect(result.files).toMatchObject([{path: '.github/dependabot.yml'}])
        expect(result.unresolvedReason).toBeUndefined()
      })
    })
  })

  test.skipIf(process.platform === 'win32')('rejects special files without attempting to read them', async () => {
    await inTemporaryDirectory(async (root) => {
      execFileSync('mkfifo', [join(root, 'renovate.json')])
      expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS).unresolvedReason).toContain('not a file')
      execFileSync('mkfifo', [join(root, '.git')])
      expect(findDependencyAutomationInputs(root, NO_GIT_EXCLUSIONS).unresolvedReason).toContain('repository ownership')
    })
  })
})

describe('manifest safety', () => {
  test('rejects escaped manifests and parent paths', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFile(join(outside, 'package.json'), '{"dependencies":{"react":"19.0.0"}}')
        await symlink(join(outside, 'package.json'), join(root, 'package.json'))
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
      expect(findManifests(root, ['my-package.json', 'package.json'])).toMatchObject([{path: 'package.json'}])
      expect(getSkippedFiles()).toEqual([])
    })
  })

  test('does not retain or validate package scripts for this check', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(join(root, 'package.json'), '{"scripts":{"audit":["npm audit"]}}')
      expect(findManifests(root, ['package.json'])).toMatchObject([{dependencies: {}, devDependencies: {}}])
      expect(findManifests(root, ['package.json'])[0]).not.toHaveProperty('scripts')
      expect(getSkippedFiles()).toEqual([])
    })
  })
})
