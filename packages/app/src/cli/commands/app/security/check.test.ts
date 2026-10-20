import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import securityCheck from '../../../services/security-check.js'
import {renderSecurityCheckPromptsTip, renderSecurityCheckResult} from '../../../services/security-check/result.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-check.js')
vi.mock('../../../services/security-check/result.js')

/** The presentation options that the command passed with the outcome. */
function presentationOptions() {
  return vi.mocked(renderSecurityCheckResult).mock.calls[0]?.[1]
}

async function expectInstructionFlagConflict(flags: string[]): Promise<void> {
  const outputMock = mockAndCaptureOutput()
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  try {
    await expect(SecurityCheck.run(flags, import.meta.url)).rejects.toThrow('process.exit unexpectedly called with "1"')
    expect(outputMock.error()).toContain('cannot also be provided')
    expect(securityCheck).not.toHaveBeenCalled()
  } finally {
    consoleErrorSpy.mockRestore()
    outputMock.clear()
  }
}

describe('app security check command', () => {
  test('documents command-specific telemetry and links to usage reporting', () => {
    expect(SecurityCheck.descriptionWithMarkdown).toContain(
      'Reports the number of findings to Shopify as usage telemetry, but not finding details.',
    )
    expect(SecurityCheck.descriptionWithMarkdown).toContain(
      '[usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting)',
    )
    expect(SecurityCheck.descriptionWithMarkdown).not.toContain('SHOPIFY_CLI_NO_ANALYTICS=1')
    expect(SecurityCheck.description).toContain('https://shopify.dev/docs/api/shopify-cli#usage-reporting')
  })

  test('double-quotes glob values in the scan example for cross-platform shells', () => {
    expect(SecurityCheck.examples).toContain(
      '<%= config.bin %> <%= command.id %> --path app --include-dir . --exclude marketing --exclude "**/generated"',
    )
  })

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

  test('forwards --path and flags to the service and presents its outcome', async () => {
    const check = {kind: 'cancelled'} as const
    vi.mocked(securityCheck).mockResolvedValue(check)

    await SecurityCheck.run(
      ['--path', './fixtures/unlinked-app', '--verbose', '--blocking', 'high', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/unlinked-app'),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      blocking: 'high',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
      listFiles: false,
      onSelectionPrompted: renderSecurityCheckPromptsTip,
    })
    expect(renderSecurityCheckResult).toHaveBeenCalledWith(check, {
      directory: resolvePath('./fixtures/unlinked-app'),
      verbose: true,
      printInstructions: false,
      skipInstructions: true,
    })
  })

  test('forwards repeated --exclude globs exactly as typed, in command-line order', async () => {
    await SecurityCheck.run(
      ['--exclude', 'generated', '--exclude', '../shared/**', '--exclude', 'a b/', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(
      expect.objectContaining({excludePatterns: ['generated', '../shared/**', 'a b/']}),
    )
  })

  test('forwards repeated --include-dir values exactly as typed, without resolving them', async () => {
    await SecurityCheck.run(
      ['--include-dir', '../backend', '--include-dir', './lib/', '--include-dir', 'a b', '--skip-instructions'],
      import.meta.url,
    )

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({includeDirs: ['../backend', './lib/', 'a b']}))
  })

  test('forwards --no-git-ignore', async () => {
    await SecurityCheck.run(['--no-git-ignore', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({noGitIgnore: true}))
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
      await expectInstructionFlagConflict(['--list-files', ...incompatible])
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

      expect(presentationOptions()).toMatchObject({printInstructions: false})
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
        expect.objectContaining({directory: '/tmp/directory-without-shopify-toml', withoutAppConfig: false}),
      )
      expect(presentationOptions()).toMatchObject({printInstructions: true, skipInstructions: false})
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

      expect(presentationOptions()).toMatchObject({printInstructions})
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
    ['1', '1', true],
    ['1', '0', true],
    ['0', '1', true],
    ['0', '0', false],
  ] as const)(
    'combines printing variables (print-instructions=%s, yes=%s) as printInstructions=%s',
    async (printValue, yesValue, printInstructions) => {
      const warningSpy = vi.spyOn(SecurityCheck.prototype, 'warn').mockImplementation((warning) => warning)
      vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', printValue)
      vi.stubEnv('SHOPIFY_FLAG_YES', yesValue)

      try {
        await SecurityCheck.run([], import.meta.url)

        expect(presentationOptions()).toMatchObject({printInstructions})
        expect(warningSpy).toHaveBeenCalledOnce()
        expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('--print-instructions'))
      } finally {
        warningSpy.mockRestore()
        vi.unstubAllEnvs()
      }
    },
  )

  test.each([
    {flag: '--print-instructions', environment: 'SHOPIFY_FLAG_YES', value: '0'},
    {flag: '--print-instructions', environment: 'SHOPIFY_FLAG_YES', value: '1'},
    {flag: '--yes', environment: 'SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', value: '0'},
    {flag: '--yes', environment: 'SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', value: '1'},
  ])('prints with $flag and $environment=$value', async ({flag, environment, value}) => {
    const warningSpy = vi.spyOn(SecurityCheck.prototype, 'warn').mockImplementation((warning) => warning)
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)
    vi.stubEnv(environment, value)

    try {
      await SecurityCheck.run([flag], import.meta.url)

      expect(presentationOptions()).toMatchObject({printInstructions: true})
      expect(warningSpy).toHaveBeenCalledOnce()
      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('--print-instructions'))
    } finally {
      warningSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  test.each([
    ['SHOPIFY_FLAG_LIST_FILES', '--print-instructions'],
    ['SHOPIFY_FLAG_LIST_FILES', '--yes'],
    ['SHOPIFY_FLAG_APP_SECURITY_SKIP_INSTRUCTIONS', '--print-instructions'],
    ['SHOPIFY_FLAG_APP_SECURITY_SKIP_INSTRUCTIONS', '--yes'],
  ])('rejects %s=1 with %s', async (environment, printingFlag) => {
    vi.stubEnv('SHOPIFY_FLAG_YES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_PRINT_INSTRUCTIONS', undefined)
    vi.stubEnv('SHOPIFY_FLAG_LIST_FILES', undefined)
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_SKIP_INSTRUCTIONS', undefined)
    vi.stubEnv(environment, '1')

    try {
      await expectInstructionFlagConflict([printingFlag])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test.each([{flags: ['--print-instructions']}, {flags: ['--yes']}, {flags: ['--print-instructions', '--yes']}])(
    'rejects $flags with --skip-instructions',
    async ({flags}) => {
      await expectInstructionFlagConflict([...flags, '--skip-instructions'])
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
      await expectInstructionFlagConflict([incompatible])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('forwards --client-id and --without-app-config', async () => {
    await SecurityCheck.run(['--without-app-config', '--client-id', 'abc123', '--skip-instructions'], import.meta.url)

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({clientId: 'abc123', withoutAppConfig: true}))
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

    expect(securityCheck).toHaveBeenCalledWith(expect.objectContaining({configName: 'staging'}))
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
      await expectInstructionFlagConflict([mode])
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
    expect(SecurityCheck.descriptionWithMarkdown).toContain('requires Git 2.38.0 or later')
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
