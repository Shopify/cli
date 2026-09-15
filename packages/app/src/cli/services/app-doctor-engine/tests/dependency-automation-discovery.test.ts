/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {
  findDependencyAutomationInputs,
  findManifests,
  getSkippedFiles,
  resetSkippedFiles,
} from '../scanners/discover.js'
import {DEPENDENCY_AUTOMATION_CONFIG_PATHS} from '../rules/dependency-automation-rules.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {afterEach, describe, expect, test} from 'vitest'
import {execFileSync} from 'node:child_process'
import {mkdir, symlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

afterEach(() => resetSkippedFiles())

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
      expect(findDependencyAutomationInputs(root)).toEqual({files: []})
      const content = 'version: 2\r\nupdates: []\r\n'
      await writeFiles(root, {
        '.github/dependabot.yml': content,
        '.gitlab/renovate.json': '{}',
        '.github/workflows/audit.yml': 'jobs: [',
        '.gitlab-ci.yml': 'include: [',
        '.circleci/config.yml': 'jobs: [',
        '.snyk': 'version: v1.25.0',
      })
      const result = findDependencyAutomationInputs(root)
      expect(result.unresolvedReason).toBeUndefined()
      expect(result.files.map(({path}) => path)).toEqual(['.github/dependabot.yml'])
      expect(result.files[0]?.content).toBe(content)
    })
  })

  test.each(DEPENDENCY_AUTOMATION_CONFIG_PATHS)('discovers the allowlisted file %s', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {[path]: '{}'})
      const result = findDependencyAutomationInputs(root)
      expect(result.files).toMatchObject([{path, content: '{}'}])
      expect(result.unresolvedReason).toBeUndefined()
    })
  })

  test('stops discovery after finding one configuration file', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'renovate.json': '{}', '.renovaterc': 'x'.repeat(500_001)})
      expect(findDependencyAutomationInputs(root).files).toMatchObject([{path: 'renovate.json'}])
      expect(getSkippedFiles()).toEqual([])
    })
  })

  test('preserves bounded reads and skipped-file coverage', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFiles(root, {'.github/dependabot.yml': 'x'.repeat(500_001)})
      expect(findDependencyAutomationInputs(root)).toMatchObject({
        files: [{path: '.github/dependabot.yml', content: undefined}],
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
      expect(findDependencyAutomationInputs(app)).toMatchObject({
        files: [],
        unresolvedReason: expect.stringContaining('nested below repository root'),
      })
      if (marker === 'directory') await mkdir(join(app, '.git'))
      else await writeFile(join(app, '.git'), 'gitdir: /outside/not-read')
      expect(findDependencyAutomationInputs(app).files).toMatchObject([{path: '.github/dependabot.yml'}])
    })
  })

  test.each(['.github', '.gitlab', '.git'])('rejects escaping or ambiguous %s directory links', async (path) => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await symlink(outside, join(root, path), 'dir')
        expect(findDependencyAutomationInputs(root)).toMatchObject({
          files: [],
          unresolvedReason: expect.any(String),
        })
      })
    })
  })

  test('rejects dangling directory links', async () => {
    await inTemporaryDirectory(async (root) => {
      await symlink(join(root, 'missing'), join(root, '.github'), 'dir')
      expect(findDependencyAutomationInputs(root).unresolvedReason).toContain('dangling symbolic link')
    })
  })

  test('rejects escaping config-file links and accepts contained ones', async () => {
    await inTemporaryDirectory(async (root) => {
      await inTemporaryDirectory(async (outside) => {
        await writeFile(join(outside, 'config.json'), '{}')
        await symlink(join(outside, 'config.json'), join(root, 'renovate.json'))
        expect(findDependencyAutomationInputs(root).unresolvedReason).toContain('outside the app root')
        await writeFiles(root, {'.github/config.yml': 'version: 2\nupdates: []'})
        await symlink(join(root, '.github/config.yml'), join(root, '.github/dependabot.yml'))
        const result = findDependencyAutomationInputs(root)
        expect(result.files).toMatchObject([{path: '.github/dependabot.yml'}])
        expect(result.unresolvedReason).toBeUndefined()
      })
    })
  })

  test.skipIf(process.platform === 'win32')('rejects special files without attempting to read them', async () => {
    await inTemporaryDirectory(async (root) => {
      execFileSync('mkfifo', [join(root, 'renovate.json')])
      expect(findDependencyAutomationInputs(root).unresolvedReason).toContain('not a file')
      execFileSync('mkfifo', [join(root, '.git')])
      expect(findDependencyAutomationInputs(root).unresolvedReason).toContain('repository ownership')
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
        expect(findManifests(root)).toMatchObject([{dependencies: {}, devDependencies: {}}])
        expect(getSkippedFiles()).toEqual([
          expect.objectContaining({reason: 'unreadable', detail: 'manifest could not be parsed'}),
        ])
      })
    },
  )

  test('does not retain or validate package scripts for this check', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(join(root, 'package.json'), '{"scripts":{"audit":["npm audit"]}}')
      expect(findManifests(root)).toMatchObject([{dependencies: {}, devDependencies: {}}])
      expect(findManifests(root)[0]).not.toHaveProperty('scripts')
      expect(getSkippedFiles()).toEqual([])
    })
  })
})
