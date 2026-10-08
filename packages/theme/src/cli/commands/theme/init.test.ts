import Init from './init.js'
import {createAIInstructions, promptAIInstruction, SKELETON_THEME_URL} from '../../services/init.js'
import {themeInitJsonOutputSchema} from '../../services/init/types.js'
import {renderAIInstructionsWarning} from '../../services/init/result.js'
import {Config} from '@oclif/core'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderSelectPrompt, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as nativePath} from 'node:path'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/github')>()),
  getLatestGitHubRelease: vi.fn(async () => ({tag_name: 'v1.0.0'})),
}))
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderSelectPrompt: vi.fn(async () => 'stable'),
  renderTextPrompt: vi.fn(),
  renderWarning: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  terminalSupportsPrompting: vi.fn(),
}))
vi.mock('../../services/init.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/init.js')>()),
  promptAIInstruction: vi.fn(),
  createAIInstructions: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/environments')

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  await new Init(argv, config).run()
}

test.each([true, false])('emits the cloned theme after skipped AI setup, interactive=%s', async (interactive) => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
  vi.mocked(promptAIInstruction).mockResolvedValue(null)
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () => run(['example', '--path', directory, '--json']))
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        changed: true,
        directory: nativePath(directory, 'example'),
        repoUrl: SKELETON_THEME_URL,
        latest: true,
        aiInstructions: null,
        instructionFilePaths: [],
        reason: null,
      })
      expect(
        stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      ).toEqual(expect.arrayContaining([expect.objectContaining({type: 'progress'})]))
    })
    expect(createAIInstructions).not.toHaveBeenCalled()
  })
})

test('preserves the name prompt in JSON mode and waits for AI instructions', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.mocked(renderTextPrompt).mockResolvedValue('chosen-name')
  vi.mocked(promptAIInstruction).mockResolvedValue('claude')
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'chosen-name')
    const instructionFiles = [joinPath(path, 'AGENTS.md'), joinPath(path, 'CLAUDE.md')]
    vi.mocked(createAIInstructions).mockImplementation(async () => {
      await mkdir(path)
      await writeFile(instructionFiles[0]!, 'Instructions')
      return {files: instructionFiles, copiedFiles: ['CLAUDE.md']}
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--path', directory, '--latest', '--clone-url', 'https://example.com/theme.git', '--json']),
      )
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        changed: true,
        directory: nativePath(path),
        repoUrl: 'https://example.com/theme.git',
        latest: true,
        aiInstructions: 'claude',
        instructionFilePaths: instructionFiles.map((path) => nativePath(path)),
        reason: null,
      })
      expect(
        stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      ).toContainEqual(
        expect.objectContaining({type: 'diagnostic', level: 'warning', message: expect.stringContaining('CLAUDE.md')}),
      )
    })
    expect(renderTextPrompt).toHaveBeenCalledOnce()
    expect(createAIInstructions).toHaveBeenCalledWith(path, 'claude')
  })
})

test('preserves the cloned project when AI setup fails', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.mocked(promptAIInstruction).mockResolvedValue('cursor')
  vi.mocked(createAIInstructions).mockRejectedValue(new Error('Failed to create AI instructions'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const previousExitCode = process.exitCode
      try {
        await runWithCommandEventsForCommand(['--json'], () => run(['example', '--path', directory, '--json']))
        expect(JSON.parse(stdout())).toEqual({
          status: 'partial',
          changed: true,
          directory: nativePath(directory, 'example'),
          repoUrl: SKELETON_THEME_URL,
          latest: true,
          aiInstructions: 'cursor',
          instructionFilePaths: null,
          reason: 'Failed to create AI instructions',
        })
        expect(stderr()).toContain('Failed to create AI instructions')
        expect(process.exitCode).toBe(1)
      } finally {
        process.exitCode = previousExitCode
      }
    })
  })
})

test('does not emit a result when cloning fails', async () => {
  vi.mocked(downloadGitRepository).mockRejectedValue(new Error('Clone failed'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(
        runWithCommandEventsForCommand(['--json'], () => run(['example', '--path', directory, '--json'])),
      ).rejects.toThrow('Clone failed')
      expect(stdout()).toBe('')
    })
  })
})

test('keeps the copy warning in the text presenter', () => {
  renderAIInstructionsWarning(['CLAUDE.md'], 'text')
  expect(renderWarning).toHaveBeenCalledWith({
    headline: 'Files created instead of symlinks.',
    body: "Shopify CLI attempted to create symbolic links between AGENTS.md and CLAUDE.md, but your system doesn't have Developer Mode enabled or symlinks are disabled. Separate files were created instead.",
  })
})

test('exposes the schema and rejects invalid instruction choices', () => {
  expect(Init.jsonOutputSchema).toBe(themeInitJsonOutputSchema)
  expect(Init.flags.json).toBeDefined()
  expect(Init.description).toContain('--json-schema')
  expect(() =>
    themeInitJsonOutputSchema.validate({
      status: 'success',
      changed: true,
      directory: nativePath('/theme'),
      reason: null,
      repoUrl: SKELETON_THEME_URL,
      latest: false,
      aiInstructions: 'invalid',
      instructionFilePaths: [],
    }),
  ).toThrow()
})

test('generates a name without prompting in non-interactive JSON mode', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(['--json'], () => run(['--path', directory, '--json']))
      const result = JSON.parse(stdout())
      expect(result).toMatchObject({status: 'success', changed: true, latest: true})
      expect(nativePath(result.directory, '..')).toBe(nativePath(directory))
      expect(result.directory).not.toBe(nativePath(directory))
    })
    expect(renderTextPrompt).not.toHaveBeenCalled()
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(promptAIInstruction).not.toHaveBeenCalled()
  })
})

test.each([
  {argv: [], interactive: true, choice: 'stable', repoUrl: `${SKELETON_THEME_URL}#v1.0.0`, latest: true},
  {argv: [], interactive: true, choice: 'upstream', repoUrl: SKELETON_THEME_URL, latest: false},
  {argv: ['--latest'], interactive: true, repoUrl: `${SKELETON_THEME_URL}#v1.0.0`, latest: true},
  {argv: ['--no-input'], interactive: true, repoUrl: `${SKELETON_THEME_URL}#v1.0.0`, latest: true},
  {argv: [], interactive: false, repoUrl: `${SKELETON_THEME_URL}#v1.0.0`, latest: true},
  {
    argv: ['--clone-url', 'https://example.com/theme.git'],
    interactive: true,
    repoUrl: 'https://example.com/theme.git',
    latest: false,
  },
  {
    argv: ['--clone-url', 'https://example.com/theme.git', '--no-input'],
    interactive: true,
    repoUrl: 'https://example.com/theme.git',
    latest: false,
  },
  {
    argv: ['--clone-url', 'https://example.com/theme.git', '--latest'],
    interactive: true,
    repoUrl: 'https://example.com/theme.git',
    latest: true,
  },
])('preserves clone selection in JSON mode: %j', async ({argv, interactive, choice, repoUrl, latest}) => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
  vi.mocked(promptAIInstruction).mockResolvedValue(null)
  if (choice) vi.mocked(renderSelectPrompt).mockResolvedValue(choice)
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(['--json'], () => run(['example', '--path', directory, '--json', ...argv]))
      expect(JSON.parse(stdout())).toMatchObject({status: 'success', latest})
    })
    expect(downloadGitRepository).toHaveBeenCalledWith(
      expect.objectContaining({repoUrl, destination: joinPath(directory, 'example')}),
    )
    if (choice) expect(renderSelectPrompt).toHaveBeenCalledOnce()
    else expect(renderSelectPrompt).not.toHaveBeenCalled()
    if (argv.some((flag) => flag === '--no-input') || !interactive) expect(promptAIInstruction).not.toHaveBeenCalled()
  })
})
