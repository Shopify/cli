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
import {renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
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
        path: joinPath(directory, 'example'),
        repoUrl: SKELETON_THEME_URL,
        latest: false,
        aiInstructions: null,
        instructionFiles: [],
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
        path,
        repoUrl: 'https://example.com/theme.git',
        latest: true,
        aiInstructions: 'claude',
        instructionFiles,
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

test('does not emit a success result when AI setup fails', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.mocked(promptAIInstruction).mockResolvedValue('cursor')
  vi.mocked(createAIInstructions).mockRejectedValue(new Error('Failed to create AI instructions'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(
        runWithCommandEventsForCommand(['--json'], () => run(['example', '--path', directory, '--json'])),
      ).rejects.toThrow('Failed to create AI instructions')
      expect(stdout()).toBe('')
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
      path: '/theme',
      repoUrl: SKELETON_THEME_URL,
      latest: false,
      aiInstructions: 'invalid',
      instructionFiles: [],
    }),
  ).toThrow()
})
