import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import securityCheck from '../../../services/security-check.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-check.js')

describe('app security check command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityCheck.hidden).toBe(true)
    expect(SecurityCheck.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityCheck.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityCheck.flags.path).toBe(appFlags.path)
    expect(SecurityCheck.flags.config).toBe(appFlags.config)
    expect(SecurityCheck.args).not.toHaveProperty('directory')
  })

  test('accepts only the scan flags, with no findings or clean flags', () => {
    const commandFlags = Object.keys(SecurityCheck.flags).filter((name) => !(name in globalFlags))

    expect(commandFlags.sort()).toEqual(['blocking', 'config', 'ignore', 'json', 'path', 'skip-instructions', 'yes'])
  })

  test('forwards --path and flags to the service', async () => {
    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--json', '--verbose', '--blocking', 'high', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      json: true,
      verbose: true,
      blocking: 'high',
      yes: false,
      skipInstructions: true,
      ignorePatterns: [],
    })
  })

  test('forwards repeated --ignore patterns in command-line order', async () => {
    await SecurityCheck.run(
      ['--ignore', 'generated/', '--ignore', '!build/', '--ignore', 'a b/', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(
      expect.objectContaining({ignorePatterns: ['generated/', '!build/', 'a b/'], skipInstructions: true}),
    )
  })

  test.each([
    ['#generated/', 'comment'],
    ['', 'empty'],
    ['!', 'nothing after'],
    ['build\\', 'ends with a backslash'],
    ['build\\\\\\', 'ends with a backslash'],
    ['src/[id/x.ts', "can't be read as a .gitignore pattern"],
    ['build/\ngenerated/', 'single line'],
  ])('rejects the unusable --ignore pattern %j', async (value, expectedMessage) => {
    const outputMock = mockAndCaptureOutput()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(SecurityCheck.run(['--ignore', value, '--skip-instructions'], import.meta.url)).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )
      expect(outputMock.error()).toContain(expectedMessage)
      expect(securityCheck).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
      outputMock.clear()
    }
  })

  test('forwards --yes without requiring an app configuration', async () => {
    await SecurityCheck.run(['--path', '/tmp/directory-without-shopify-toml', '--yes'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith({
      directory: '/tmp/directory-without-shopify-toml',
      configName: undefined,
      json: false,
      verbose: false,
      blocking: 'none',
      yes: true,
      skipInstructions: false,
      ignorePatterns: [],
    })
  })

  test('forwards --config without requiring a linked app', async () => {
    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--config', 'staging', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({configName: 'staging', skipInstructions: true}))
  })

  test.each(['--findings', '--clean'])('rejects the removed %s flag', async (removedFlag) => {
    await expect(SecurityCheck.run([removedFlag, '--skip-instructions'], import.meta.url)).rejects.toThrow()
  })

  test('describes the artifacts it writes and how agent results are recorded', () => {
    expect(SecurityCheck.flags.yes.description).toBe('Print coding-agent instructions without prompting.')
    expect(SecurityCheck.flags['skip-instructions'].description).toBe("Don't offer to show coding-agent instructions.")
    expect(SecurityCheck.flags.yes.exclusive).toEqual(['skip-instructions'])
    expect(SecurityCheck.flags['skip-instructions'].exclusive).toEqual(['yes'])
    expect(SecurityCheck.summary).toContain('deterministic-findings.json')
    expect(SecurityCheck.summary).toContain('agent-checks.json')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`deterministic-findings.json` and `agent-checks.json`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`shopify app security record`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copy the coding-agent instructions')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--config`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copying is the default')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('shopify app security instructions')
    expect(SecurityCheck.descriptionWithMarkdown).not.toMatch(/--findings|--clean|compile|trace/)
  })

  test('documents --ignore as ordered .gitignore patterns that the coding-agent instructions repeat', () => {
    expect(SecurityCheck.flags.ignore.multiple).toBe(true)
    expect(SecurityCheck.flags.ignore.description).toBe(
      'Ignore files that match this .gitignore pattern, relative to the app directory. Start the pattern with ! to include matching files again. Repeat the flag to add patterns; later patterns take precedence.',
    )
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--ignore`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('relative to the app directory')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('later patterns take precedence')
    expect(SecurityCheck.descriptionWithMarkdown).toContain("--ignore '!build/'")
    expect(SecurityCheck.descriptionWithMarkdown).toContain('single quotes in POSIX shells and PowerShell')
    expect(SecurityCheck.descriptionWithMarkdown).toContain(
      'The coding-agent instructions this check offers repeat the patterns.',
    )
    expect(SecurityCheck.descriptionWithMarkdown).toContain("Other `app security` commands don't take `--ignore`")
  })

  test('allows --yes in JSON mode while preserving non-interactive output behavior', async () => {
    await SecurityCheck.run(['--json', '--yes'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({json: true, yes: true}))
  })
})
