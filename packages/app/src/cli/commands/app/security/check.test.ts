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
  test('does not require linked app context', () => {
    expect(SecurityCheck.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityCheck.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityCheck.flags.path).toBe(appFlags.path)
    expect(SecurityCheck.flags.config).toBe(appFlags.config)
    expect(SecurityCheck.args).not.toHaveProperty('directory')
  })

  test('accepts only the scan flags, with no findings or clean flags', () => {
    const commandFlags = Object.keys(SecurityCheck.flags).filter((name) => !(name in globalFlags))

    expect(commandFlags.sort()).toEqual([
      'blocking',
      'client-id',
      'config',
      'exclude',
      'include-dir',
      'list-files',
      'no-git-ignore',
      'path',
      'print-instructions',
      'skip-instructions',
      'without-app-config',
      'yes',
    ])
  })

  test('forwards --path and flags to the service', async () => {
    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--verbose', '--blocking', 'high', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      verbose: true,
      blocking: 'high',
      printInstructions: false,
      skipInstructions: true,
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
      listFiles: false,
    })
  })

  test('forwards repeated --exclude globs exactly as typed, in command-line order', async () => {
    await SecurityCheck.run(
      ['--exclude', 'generated', '--exclude', '../shared/**', '--exclude', 'a b/', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(
      expect.objectContaining({excludePatterns: ['generated', '../shared/**', 'a b/'], skipInstructions: true}),
    )
  })

  test('forwards repeated --include-dir values exactly as typed, without resolving them', async () => {
    await SecurityCheck.run(
      ['--include-dir', '../backend', '--include-dir', './lib/', '--include-dir', 'a b', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(
      expect.objectContaining({includeDirs: ['../backend', './lib/', 'a b'], skipInstructions: true}),
    )
  })

  test('forwards --no-git-ignore', async () => {
    await SecurityCheck.run(['--no-git-ignore', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({noGitIgnore: true, skipInstructions: true}))
  })

  test('reads --include-dir and --exclude only from the command line', () => {
    expect(SecurityCheck.flags['include-dir'].env).toBeUndefined()
    expect(SecurityCheck.flags['include-dir'].multiple).toBe(true)
    expect(SecurityCheck.flags.exclude.env).toBeUndefined()
    expect(SecurityCheck.flags['no-git-ignore'].env).toBe('SHOPIFY_FLAG_NO_GIT_IGNORE')
  })

  test('forwards --list-files, which is also set by its environment variable', async () => {
    await SecurityCheck.run(['--list-files'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({listFiles: true}))
    expect(SecurityCheck.flags['list-files'].env).toBe('SHOPIFY_FLAG_LIST_FILES')
  })

  test('keeps --list-files exclusive with printing, --skip-instructions and --blocking', async () => {
    expect(SecurityCheck.flags['list-files'].exclusive).toEqual(['print-instructions', 'skip-instructions', 'blocking'])

    for (const incompatible of [['--print-instructions'], ['--yes'], ['--skip-instructions'], ['--blocking', 'high']]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(SecurityCheck.run(['--list-files', ...incompatible], import.meta.url)).rejects.toThrow()
    }
  })

  test('rejects the removed --ignore flag', async () => {
    await expect(SecurityCheck.run(['--ignore', 'build/', '--skip-instructions'], import.meta.url)).rejects.toThrow()
  })

  test('keeps --yes hidden and deprecated without warning on default invocations', async () => {
    const warningSpy = vi.spyOn(SecurityCheck.prototype, 'warn').mockImplementation((warning) => warning)
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)

    try {
      expect(SecurityCheck.flags.yes.hidden).toBe(true)
      expect(SecurityCheck.flags.yes.deprecated).toEqual({to: '--print-instructions'})
      expect(SecurityCheck.flags.yes.env).toBe('SHOPIFY_FLAG_YES')
      expect(SecurityCheck.flags.yes.default).toBeUndefined()
      expect(SecurityCheck.flags['print-instructions'].default).toBe(false)

      await SecurityCheck.run([], import.meta.url)

      expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({printInstructions: false}))
      expect(warningSpy).not.toHaveBeenCalled()
    } finally {
      warningSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  test.each([
    {name: '--print-instructions', flags: ['--print-instructions'], deprecated: false},
    {name: '--yes', flags: ['--yes'], deprecated: true},
    {name: '--no-input --print-instructions', flags: ['--no-input', '--print-instructions'], deprecated: false},
    {name: '--no-input --yes', flags: ['--no-input', '--yes'], deprecated: true},
    {name: 'both printing flags', flags: ['--print-instructions', '--yes'], deprecated: true},
  ])('forwards $name without bypassing app selection', async ({flags, deprecated}) => {
    const warningSpy = vi.spyOn(SecurityCheck.prototype, 'warn').mockImplementation((warning) => warning)
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', undefined)

    try {
      await SecurityCheck.run(['--path', '/tmp/directory-without-shopify-toml', ...flags], import.meta.url)

      expect(securityCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          directory: '/tmp/directory-without-shopify-toml',
          printInstructions: true,
          withoutAppConfig: false,
          skipInstructions: false,
        }),
      )
      if (deprecated) {
        expect(warningSpy).toHaveBeenCalledOnce()
        expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('--print-instructions'))
      } else {
        expect(warningSpy).not.toHaveBeenCalled()
      }
    } finally {
      warningSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  test.each([
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '1', true, false],
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '0', false, false],
    ['SHOPIFY_FLAG_YES', '1', true, true],
    ['SHOPIFY_FLAG_YES', '0', false, true],
  ] as const)('reads %s=%s as printInstructions=%s', async (environment, value, printInstructions, deprecated) => {
    const warningSpy = vi.spyOn(SecurityCheck.prototype, 'warn').mockImplementation((warning) => warning)
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)
    vi.stubEnv(environment, value)

    try {
      await SecurityCheck.run([], import.meta.url)

      expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({printInstructions}))
      if (deprecated) {
        expect(warningSpy).toHaveBeenCalledOnce()
        expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('--print-instructions'))
      } else {
        expect(warningSpy).not.toHaveBeenCalled()
      }
    } finally {
      warningSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  test.each([{flags: ['--print-instructions']}, {flags: ['--yes']}, {flags: ['--print-instructions', '--yes']}])(
    'rejects $flags with --skip-instructions',
    async ({flags}) => {
      await expect(SecurityCheck.run([...flags, '--skip-instructions'], import.meta.url)).rejects.toThrow()
      expect(securityCheck).not.toHaveBeenCalled()
    },
  )

  test.each([
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '--skip-instructions'],
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '--list-files'],
    ['SHOPIFY_FLAG_YES', '--skip-instructions'],
    ['SHOPIFY_FLAG_YES', '--list-files'],
  ])('rejects %s with %s', async (environment, incompatible) => {
    vi.stubEnv(environment, '1')

    try {
      await expect(SecurityCheck.run([incompatible], import.meta.url)).rejects.toThrow()
      expect(securityCheck).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('forwards --client-id and --without-app-config', async () => {
    await SecurityCheck.run(['--without-app-config', '--client-id', 'abc123', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(
      expect.objectContaining({clientId: 'abc123', withoutAppConfig: true, skipInstructions: true}),
    )
  })

  test.each([
    [['--without-app-config'], 'client-id'],
    [['--without-app-config', '--client-id', 'abc123', '--config', 'staging'], 'config'],
    [['--client-id', 'abc123', '--config', 'staging'], 'config'],
  ])('rejects the flags %j', async (flags, expectedFlag) => {
    const outputMock = mockAndCaptureOutput()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(SecurityCheck.run([...flags, '--skip-instructions'], import.meta.url)).rejects.toThrow(
        'process.exit unexpectedly called with "1"',
      )
      expect(outputMock.error()).toContain(expectedFlag)
      expect(securityCheck).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
      outputMock.clear()
    }
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

  test.each([
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '--skip-instructions'],
    ['SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', '--list-files'],
    ['SHOPIFY_FLAG_YES', '--skip-instructions'],
    ['SHOPIFY_FLAG_YES', '--list-files'],
  ])('rejects %s=0 with %s, preserving explicit flag exclusions', async (environment, mode) => {
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)
    vi.stubEnv(environment, '0')

    try {
      await expect(SecurityCheck.run([mode], import.meta.url)).rejects.toThrow()
      expect(securityCheck).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('describes the artifacts it writes and how agent results are recorded', () => {
    expect(SecurityCheck.flags['print-instructions'].description).toBe(
      'Print coding-agent instructions without prompting for how to deliver them.',
    )
    expect(SecurityCheck.flags['skip-instructions'].description).toBe(
      "Don't offer the coding-agent instructions after the scan. Use it when you want only the deterministic scan results.",
    )
    expect(SecurityCheck.flags.yes.exclusive).toEqual(['skip-instructions', 'list-files'])
    expect(SecurityCheck.flags['print-instructions'].exclusive).toEqual(['skip-instructions'])
    expect(SecurityCheck.flags['skip-instructions'].exclusive).toEqual(['print-instructions'])
    expect(SecurityCheck.summary).toContain('deterministic-findings.json')
    expect(SecurityCheck.summary).toContain('agent-checks.json')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`deterministic-findings.json` and `agent-checks.json`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`shopify app security record`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copy the coding-agent instructions')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--config`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('copying is the default')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('shopify app security instructions')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--print-instructions`')
    expect(SecurityCheck.descriptionWithMarkdown).not.toContain('`--yes`')
    expect(SecurityCheck.descriptionWithMarkdown).not.toMatch(/--findings|--clean|compile|trace/)
  })

  test('documents what is scanned, --exclude and --no-git-ignore', () => {
    expect(SecurityCheck.flags.exclude.multiple).toBe(true)
    expect(SecurityCheck.flags.exclude.description).toBe(
      "Skip paths that match this glob, relative to the working directory. Repeat the flag to add globs. The selected app configuration file can't be excluded.",
    )
    expect(SecurityCheck.flags['no-git-ignore'].description).toBe(
      'Turn off Git ignore rules for every scanned directory, so files that Git ignores are scanned too. Files that Git tracks are always scanned.',
    )
    expect(SecurityCheck.descriptionWithMarkdown).toContain('scans the app directory and each `--include-dir`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('files that Git tracks are always scanned')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('relative to the working directory')
    expect(SecurityCheck.descriptionWithMarkdown).toContain("--exclude '**/generated'")
    expect(SecurityCheck.descriptionWithMarkdown).toContain(
      "An exclusion can't remove the selected app configuration file.",
    )
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`--no-git-ignore` to turn Git ignore rules off')
    expect(SecurityCheck.descriptionWithMarkdown).toContain('`.shopify/app-security/<results key>/`')
    expect(SecurityCheck.descriptionWithMarkdown).toContain(
      "Other `app security` commands don't take `--exclude` or `--no-git-ignore`",
    )
    expect(SecurityCheck.descriptionWithMarkdown).not.toContain('--ignore')
  })
})
