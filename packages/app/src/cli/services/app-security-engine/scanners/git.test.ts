import {scan} from './index.js'
import {runGit} from './git.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {ensureGitVersionIsAtLeast} from '@shopify/cli-kit/node/git'
import {dirname, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {ScanOptions} from '../types.js'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/system')

const unsupportedGitMessage = 'Git 2.38.0 or later is required, but version 2.37.6 is installed.'

// Assembled at runtime so secret scanners pointed at this repository don't flag a literal.
const environmentSecret = () => `SHOPIFY_API_SECRET=${['shp', 'ss_', '0123456789abcdef'.repeat(2)].join('')}\n`

beforeEach(() => {
  vi.mocked(ensureGitVersionIsAtLeast).mockReset().mockResolvedValue()
  // Answers as a repository in which nothing is ignored.
  vi.mocked(captureOutputWithExitCode)
    .mockReset()
    .mockImplementation(async (_command, args) => {
      if (args.includes('rev-parse')) return {exitCode: 0, stdout: 'true\n', stderr: ''}
      if (args.includes('check-ignore')) return {exitCode: 1, stdout: '', stderr: ''}
      return {exitCode: 0, stdout: '', stderr: ''}
    })
})

/** Writes an app in a real temporary directory and scans it the way the CLI would. */
async function withApp(
  files: Record<string, string>,
  callback: (app: {appDirectory: string; scan: (options?: ScanOptions) => Promise<unknown>}) => Promise<void>,
) {
  await inTemporaryDirectory(async (directory) => {
    const appDirectory = normalizePath(await fileRealPath(directory))
    const appConfigFilePath = joinPath(appDirectory, 'shopify.app.toml')
    await writeFile(
      appConfigFilePath,
      'name = "Git version"\nclient_id = "abc123"\napplication_url = "https://example.com"\n',
    )
    for (const [path, content] of Object.entries(files)) {
      // eslint-disable-next-line no-await-in-loop
      await mkdir(dirname(joinPath(appDirectory, path)))
      // eslint-disable-next-line no-await-in-loop
      await writeFile(joinPath(appDirectory, path), content)
    }
    const input = {appDirectory, scanDirectories: [appDirectory], requestedScanDirectories: [appDirectory]}
    await callback({appDirectory, scan: (options) => scan({...input, appConfigFilePath}, options)})
  })
}

function gitCommandDirectories(): (string | undefined)[] {
  return vi.mocked(captureOutputWithExitCode).mock.calls.map(([, , options]) => options?.cwd)
}

describe('runGit', () => {
  test('checks the Git version lazily, in the directory of every command', async () => {
    expect(ensureGitVersionIsAtLeast).not.toHaveBeenCalled()

    await expect(runGit('/app', ['rev-parse', '--is-inside-work-tree'])).resolves.toEqual({
      exitCode: 0,
      stdout: 'true\n',
    })
    await runGit('/app', ['ls-files'])
    await runGit('/backend', ['ls-files'])

    expect(vi.mocked(ensureGitVersionIsAtLeast).mock.calls).toEqual([
      ['2.38.0', {cwd: '/app'}],
      ['2.38.0', {cwd: '/app'}],
      ['2.38.0', {cwd: '/backend'}],
    ])
    expect(gitCommandDirectories()).toEqual(['/app', '/app', '/backend'])
  })

  test('does not run a Git command when the version is unsupported', async () => {
    vi.mocked(ensureGitVersionIsAtLeast).mockRejectedValue(new AbortError(unsupportedGitMessage))

    await expect(runGit('/app', ['rev-parse', '--is-inside-work-tree'])).rejects.toThrow(unsupportedGitMessage)

    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })

  test('resolves to undefined when the Git command throws after the version check passes', async () => {
    vi.mocked(captureOutputWithExitCode).mockRejectedValue(new Error('spawn git EACCES'))

    await expect(runGit('/app', ['rev-parse', '--is-inside-work-tree'])).resolves.toBeUndefined()

    expect(ensureGitVersionIsAtLeast).toHaveBeenCalledWith('2.38.0', {cwd: '/app'})
  })
})

describe('scanning', () => {
  test('stops a default scan with the unsupported-version error before running Git', async () => {
    vi.mocked(ensureGitVersionIsAtLeast).mockRejectedValue(new AbortError(unsupportedGitMessage))

    await withApp({'index.ts': 'export const answer = 42\n'}, async ({scan}) => {
      await expect(scan()).rejects.toThrow(unsupportedGitMessage)
    })

    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })

  test('checks a nested repository separately and stops when the Git selected there is unsupported', async () => {
    await withApp(
      {'nested/.git/HEAD': 'ref: refs/heads/main\n', 'nested/index.ts': ''},
      async ({appDirectory, scan}) => {
        const nested = joinPath(appDirectory, 'nested')
        vi.mocked(ensureGitVersionIsAtLeast).mockImplementation(async (_minimumVersion, options) => {
          if (options?.cwd === nested) throw new AbortError(unsupportedGitMessage)
        })

        await expect(scan()).rejects.toThrow(unsupportedGitMessage)

        expect(ensureGitVersionIsAtLeast).toHaveBeenCalledWith(expect.any(String), {cwd: appDirectory})
        expect(ensureGitVersionIsAtLeast).toHaveBeenCalledWith(expect.any(String), {cwd: nested})
        expect(gitCommandDirectories()).toContain(appDirectory)
        expect(gitCommandDirectories()).not.toContain(nested)
      },
    )
  })

  test('does not check the Git version when --no-git-ignore avoids every Git operation', async () => {
    await withApp({'index.ts': 'export const answer = 42\n'}, async ({scan}) => {
      await scan({noGitIgnore: true})
    })

    expect(ensureGitVersionIsAtLeast).not.toHaveBeenCalled()
    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })

  test('checks the Git version with --no-git-ignore before asking Git about a secret candidate', async () => {
    vi.mocked(ensureGitVersionIsAtLeast).mockRejectedValue(new AbortError(unsupportedGitMessage))

    await withApp({'.env': environmentSecret()}, async ({appDirectory, scan}) => {
      await expect(scan({noGitIgnore: true})).rejects.toThrow(unsupportedGitMessage)

      expect(ensureGitVersionIsAtLeast).toHaveBeenCalledWith(expect.any(String), {cwd: appDirectory})
    })

    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })
})
