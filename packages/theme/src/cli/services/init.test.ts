import {
  cloneRepoAndCheckoutLatestTag,
  cloneLatestStableSkeletonTheme,
  cloneRepo,
  createAIInstructions,
  createAIInstructionFiles,
  SKELETON_THEME_URL,
} from './init.js'
import {describe, expect, vi, test} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {fileExists, readFile, writeFile, mkdir, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getLatestGitHubRelease, type GithubRelease} from '@shopify/cli-kit/node/github'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/github')

describe.each([cloneRepo, cloneRepoAndCheckoutLatestTag])('%s', (clone) => {
  test.each([SKELETON_THEME_URL, 'https://github.com/Shopify/dawn.git'])('clones and cleans up %s', async (repoUrl) => {
    await inTemporaryDirectory(async (destination) => {
      await Promise.all(['.github', '.cursor', '.claude', '.git'].map((name) => mkdir(joinPath(destination, name))))
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const result = await runWithCommandEventsForCommand(['--json'], () => clone(repoUrl, destination))
        expect(result).toEqual({
          path: destination,
          repoUrl,
          latest: clone === cloneRepoAndCheckoutLatestTag,
          aiInstructions: null,
          instructionFiles: [],
        })
        expect(stdout()).toBe('')
        expect(stderr()).toContain('progress')
      })
      expect(downloadGitRepository).toHaveBeenCalledWith({
        repoUrl,
        destination,
        latestTag: clone === cloneRepoAndCheckoutLatestTag ? true : undefined,
        shallow: clone !== cloneRepoAndCheckoutLatestTag,
      })
      expect(removeGitRemote).toHaveBeenCalledWith(destination)
      for (const name of ['.github', '.cursor', '.claude', '.git']) {
        // eslint-disable-next-line no-await-in-loop
        await expect(fileExists(joinPath(destination, name))).resolves.toBe(repoUrl !== SKELETON_THEME_URL)
      }
    })
  })
})

test.each(['cursor', 'github', 'claude', 'all'] as const)(
  'creates the requested %s instruction files',
  async (choice) => {
    vi.mocked(downloadGitRepository).mockImplementation(async ({destination}) => {
      await mkdir(joinPath(destination, 'ai/github'))
      await writeFile(joinPath(destination, 'ai/github/copilot-instructions.md'), 'AI instructions')
    })
    await inTemporaryDirectory(async (destination) => {
      await withCapturedStandardStreams(async () => {
        const result = await runWithCommandEventsForCommand(['--json'], () => createAIInstructions(destination, choice))
        const names = ['AGENTS.md']
        if (choice === 'github' || choice === 'all') names.push('copilot-instructions.md')
        if (choice === 'claude' || choice === 'all') names.push('CLAUDE.md')
        expect(result.files).toEqual(names.map((name) => joinPath(destination, name)))
        for (const path of result.files) {
          // eslint-disable-next-line no-await-in-loop
          await expect(readFile(path)).resolves.toBe('# AGENTS.md\n\nAI instructions')
        }
      })
    })
  },
)

test.each(['github', 'claude'] as const)(
  'falls back to copying %s when a symlink cannot be created',
  async (choice) => {
    await inTemporaryDirectory(async (directory) => {
      const agentsPath = joinPath(directory, 'AGENTS.md')
      const filename = choice === 'github' ? 'copilot-instructions.md' : 'CLAUDE.md'
      await writeFile(agentsPath, 'Instructions')
      // An existing file prevents symlink creation on every platform.
      await writeFile(joinPath(directory, filename), 'Old instructions')
      await expect(createAIInstructionFiles(directory, agentsPath, choice)).resolves.toEqual({copiedFile: filename})
      await expect(readFile(joinPath(directory, filename))).resolves.toBe('Instructions')
    })
  },
)

test('preserves the error when instruction source files are missing', async () => {
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async () => {
      await expect(
        runWithCommandEventsForCommand(['--json'], () => createAIInstructions(directory, 'cursor')),
      ).rejects.toThrow('Failed to create AI instructions')
    })
  })
})

test('propagates clone failures', async () => {
  vi.mocked(downloadGitRepository).mockRejectedValue(new Error('Clone failed'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runWithCommandEventsForCommand(['--json'], () => cloneRepo('repo', directory))).rejects.toThrow(
        'Clone failed',
      )
      expect(stdout()).toBe('')
    })
  })
})

test('returns stable Skeleton clone metadata and removes development files', async () => {
  vi.mocked(getLatestGitHubRelease).mockResolvedValue({tag_name: 'v1.0.0'} as GithubRelease)
  await inTemporaryDirectory(async (destination) => {
    await Promise.all(['.github', '.cursor', '.claude', '.git'].map((name) => mkdir(joinPath(destination, name))))
    await withCapturedStandardStreams(async () => {
      const result = await runWithCommandEventsForCommand(['--json'], () => cloneLatestStableSkeletonTheme(destination))
      expect(result).toEqual({
        path: destination,
        repoUrl: SKELETON_THEME_URL,
        latest: true,
        aiInstructions: null,
        instructionFiles: [],
      })
    })
    expect(downloadGitRepository).toHaveBeenCalledWith({
      repoUrl: `${SKELETON_THEME_URL}#v1.0.0`,
      destination,
      latestTag: undefined,
      shallow: true,
    })
    for (const name of ['.github', '.cursor', '.claude', '.git']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(fileExists(joinPath(destination, name))).resolves.toBe(false)
    }
  })
  const filter = vi.mocked(getLatestGitHubRelease).mock.calls[0]![2]!.filter
  expect(filter({draft: false, prerelease: false} as GithubRelease)).toBe(true)
  expect(filter({draft: false, prerelease: true} as GithubRelease)).toBe(false)
  expect(filter({draft: true, prerelease: false} as GithubRelease)).toBe(false)
})

test('fails without cloning when no stable Skeleton release exists', async () => {
  vi.mocked(getLatestGitHubRelease).mockResolvedValue(undefined as unknown as GithubRelease)
  await inTemporaryDirectory(async (destination) => {
    await expect(cloneLatestStableSkeletonTheme(destination)).rejects.toThrow(
      "Couldn't find a stable Skeleton theme release",
    )
    expect(downloadGitRepository).not.toHaveBeenCalled()
  })
})
