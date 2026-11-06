import SecurityReview from './review.js'
import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import {appSecurityInstructions} from '../../../services/app-security-instructions.js'
import {SUPPRESSION_KINDS} from '../../../services/app-security-suppressions.js'
import securityReview from '../../../services/security-review.js'
import {interactiveSecurityReview} from '../../../services/security-review-interactive.js'
import {renderSecurityReviewResult} from '../../../services/security-review/result.js'
import {appSecurityReviewJsonOutputSchema} from '../../../services/security-review/types.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-review.js')
vi.mock('../../../services/security-review/result.js')
vi.mock('../../../services/security-review-interactive.js')

/**
 * The arguments of the `review --suppress` command that the agent instructions show, for an app in the working
 * directory, with each placeholder replaced by its value.
 */
function instructedSuppressArguments(values: {[placeholder: string]: string}): string[] {
  const appDirectory = cwd()
  const selection = {
    kind: 'config' as const,
    appDirectory,
    appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
  }
  const instructions = appSecurityInstructions({
    appDirectory,
    resultsKey: 'shopify.app',
    commands: resolveAppSecurityCommands(selection, appDirectory),
    shell: 'posix',
  })
  const reviewCommand = 'shopify app security review '
  const command = instructions
    .split('\n')
    .find((line) => line.startsWith(reviewCommand) && line.includes(' --suppress '))
  if (!command) throw new Error('The instructions show no review --suppress command')
  return command
    .slice(reviewCommand.length)
    .split(' ')
    .map((argument) => values[argument] ?? argument)
}

/**
 * Runs the command, expecting oclif to refuse the flags before anything is reviewed, and returns the error output: on
 * stderr, or as the JSON error document on stdout with --json.
 */
async function parseError(argv: string[]): Promise<string> {
  const outputMock = mockAndCaptureOutput()
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(SecurityReview.run(argv, import.meta.url)).rejects.toThrow(/process.exit unexpectedly called/)
    expect(securityReview).not.toHaveBeenCalled()
    expect(interactiveSecurityReview).not.toHaveBeenCalled()
    return outputMock.error() + outputMock.output()
  } finally {
    consoleErrorSpy.mockRestore()
    outputMock.clear()
  }
}

describe('app security review command', () => {
  test('documents command-specific telemetry and links to usage reporting', () => {
    expect(SecurityReview.descriptionWithMarkdown).toContain(
      'Reports the number of findings to Shopify as usage telemetry, but not finding details.',
    )
    expect(SecurityReview.descriptionWithMarkdown).toContain(
      '[usage reporting](https://shopify.dev/docs/api/shopify-cli#usage-reporting)',
    )
    expect(SecurityReview.descriptionWithMarkdown).not.toContain('SHOPIFY_CLI_NO_ANALYTICS=1')
    expect(SecurityReview.description).toContain('https://shopify.dev/docs/api/shopify-cli#usage-reporting')
  })

  test('does not require linked app context', () => {
    expect(SecurityReview.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityReview.prototype).not.toBeInstanceOf(AppLinkedCommand)
  })

  test('defines --json and exposes the result schema', () => {
    expect(SecurityReview.flags.json).toBe(jsonFlag.json)
    expect(SecurityReview.jsonOutputSchema).toBe(appSecurityReviewJsonOutputSchema)
  })

  test('defines the selection flags as check does', () => {
    expect(SecurityReview.flags.path).toBe(appFlags.path)
    expect(SecurityReview.flags.config).toBe(appFlags.config)
    expect(SecurityReview.flags['client-id']).toBe(appFlags['client-id'])
    expect(SecurityReview.flags['without-app-config']).toBe(SecurityCheck.flags['without-app-config'])
  })

  test('shares the --blocking flag with check', () => {
    expect(SecurityReview.flags.blocking).toBe(SecurityCheck.flags.blocking)
    expect(SecurityReview.flags.blocking.options).toEqual(['high', 'medium', 'low', 'none'])
    expect(SecurityReview.flags.blocking.env).toBe('SHOPIFY_FLAG_APP_SECURITY_BLOCKING')
  })

  test('reads --check-id repeatedly and from SHOPIFY_FLAG_CHECK_ID', () => {
    expect(SecurityReview.flags['check-id'].multiple).toBe(true)
    expect(SecurityReview.flags['check-id'].env).toBe('SHOPIFY_FLAG_CHECK_ID')
  })

  test('reviews the current directory by default with no filter and no blocking', async () => {
    await SecurityReview.run([], import.meta.url)

    expect(securityReview).toHaveBeenCalledWith({
      directory: cwd(),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      checkIds: [],
      blocking: 'none',
    })
  })

  test.each([
    ['in the terminal', [], false, 'text'],
    ['in the terminal with --verbose', ['--verbose'], true, 'text'],
    ['as JSON with --json', ['--json'], false, 'json'],
    ['as JSON with -j', ['-j'], false, 'json'],
    ['as JSON with --json and --verbose', ['--json', '--verbose'], true, 'json'],
  ])('presents the reviewed results %s', async (_description, argv, verbose, format) => {
    const review = {} as Awaited<ReturnType<typeof securityReview>>
    vi.mocked(securityReview).mockResolvedValue(review)

    await SecurityReview.run(argv, import.meta.url)

    expect(renderSecurityReviewResult).toHaveBeenCalledWith(review, {verbose}, format)
  })

  test('forwards --path, --config, --client-id and --without-app-config', async () => {
    await SecurityReview.run(
      ['--path', './fixtures/app', '--without-app-config', '--client-id', 'abc123'],
      import.meta.url,
    )

    expect(securityReview).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: resolvePath('./fixtures/app'),
        clientId: 'abc123',
        withoutAppConfig: true,
      }),
    )

    await SecurityReview.run(['--path', './fixtures/app', '--config', 'staging'], import.meta.url)

    expect(securityReview).toHaveBeenLastCalledWith(expect.objectContaining({configName: 'staging'}))
  })

  test('forwards --path, every --check-id and --blocking', async () => {
    await SecurityReview.run(
      [
        '--path',
        './fixtures/app',
        '--verbose',
        '--check-id',
        'OPEN_REDIRECT',
        '--check-id',
        'EOL_API_VERSION',
        '--blocking',
        'medium',
      ],
      import.meta.url,
    )

    expect(securityReview).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/app'),
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      checkIds: ['OPEN_REDIRECT', 'EOL_API_VERSION'],
      blocking: 'medium',
    })
  })

  test('defines suppression help and the remaining environment variables', () => {
    expect(SecurityReview.flags['results-digest'].env).toBe('SHOPIFY_FLAG_APP_SECURITY_RESULTS_DIGEST')
    expect(SecurityReview.flags['include-superseded'].env).toBe('SHOPIFY_FLAG_APP_SECURITY_INCLUDE_SUPERSEDED')
    expect(SecurityReview.flags.kind.description).toContain('false-positive or accepted-risk')
  })

  test('forwards --suppress with its flags as typed, so the service checks the kind and the reason', async () => {
    await SecurityReview.run(
      [
        '--suppress',
        '3',
        '--kind',
        'false-positive',
        '--reason',
        'A fake token in a test fixture.',
        '--results-digest',
        'abc123def456',
        '--include-superseded',
      ],
      import.meta.url,
    )

    expect(securityReview).toHaveBeenCalledWith(
      expect.objectContaining({
        suppress: {
          findingNumber: 3,
          kind: 'false-positive',
          reason: 'A fake token in a test fixture.',
          resultsDigest: 'abc123def456',
          includeSuperseded: true,
        },
      }),
    )

    await SecurityReview.run(['--suppress', '1', '--kind', 'wont-fix'], import.meta.url)

    expect(securityReview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        suppress: {
          findingNumber: 1,
          kind: 'wont-fix',
          reason: undefined,
          resultsDigest: undefined,
          includeSuperseded: false,
        },
      }),
    )
  })

  test('reads --suppress and its flags from their environment variables', async () => {
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_SUPPRESS', '2')
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_SUPPRESSION_KIND', 'accepted-risk')
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_SUPPRESSION_REASON', 'Kept until the migration ships.')
    try {
      await SecurityReview.run([], import.meta.url)
    } finally {
      vi.unstubAllEnvs()
    }

    expect(securityReview).toHaveBeenCalledWith(
      expect.objectContaining({
        suppress: expect.objectContaining({
          findingNumber: 2,
          kind: 'accepted-risk',
          reason: 'Kept until the migration ships.',
        }),
      }),
    )
  })

  test('accepts the --suppress command that the agent instructions show, with and without --include-superseded', async () => {
    const argv = instructedSuppressArguments({
      '<number>': '4',
      '<kind>': SUPPRESSION_KINDS[1],
      '<reason>': 'Kept until the migration ships.',
      '<digest>': 'abc123def456',
    })

    expect(argv).not.toContainEqual(expect.stringMatching(/^</))

    await SecurityReview.run(argv, import.meta.url)
    await SecurityReview.run([...argv, '--include-superseded'], import.meta.url)

    const suppress = {
      findingNumber: 4,
      kind: SUPPRESSION_KINDS[1],
      reason: 'Kept until the migration ships.',
      resultsDigest: 'abc123def456',
    }
    expect(securityReview).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({suppress: {...suppress, includeSuperseded: false}}),
    )
    expect(securityReview).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({suppress: {...suppress, includeSuperseded: true}}),
    )
  })

  test('passes no suppress options without --suppress', async () => {
    await SecurityReview.run(['--blocking', 'high'], import.meta.url)

    expect(vi.mocked(securityReview).mock.calls[0]![0]).not.toHaveProperty('suppress')
  })

  test.each([
    ['--kind', ['--kind', 'false-positive']],
    ['--reason', ['--reason', 'r']],
    ['--results-digest', ['--results-digest', 'abc']],
    ['--include-superseded', ['--include-superseded']],
  ])('refuses %s without --suppress', async (_flag, argv) => {
    await expect(parseError(argv)).resolves.toContain('--suppress')
  })

  test.each([
    ['0', 'Expected an integer greater than or equal to 1 but received: 0'],
    ['-1', 'Expected an integer greater than or equal to 1 but received: -1'],
    ['two', 'Expected an integer but received: two'],
  ])('refuses --suppress %s, which is not a finding number', async (value, message) => {
    const error = await parseError(['--suppress', value, '--kind', 'false-positive', '--reason', 'r'])

    expect(error).toContain('Parsing --suppress')
    expect(error).toContain(message)
  })

  test('does not define a negated interactive flag', () => {
    expect(SecurityReview.flags.interactive.allowNo).toBeFalsy()
  })

  test('passes the interactive session to the review with --interactive', async () => {
    const session = vi.fn()
    vi.mocked(interactiveSecurityReview).mockReturnValue(session)

    await SecurityReview.run(['--interactive', '--check-id', 'EOL_API_VERSION', '--blocking', 'high'], import.meta.url)

    expect(interactiveSecurityReview).toHaveBeenCalledOnce()
    expect(securityReview).toHaveBeenCalledWith(
      expect.objectContaining({interactive: session, checkIds: ['EOL_API_VERSION'], blocking: 'high'}),
    )
    expect(vi.mocked(securityReview).mock.calls[0]![0]).not.toHaveProperty('suppress')
    expect(renderSecurityReviewResult).toHaveBeenCalledWith(undefined, {verbose: false}, 'text')
  })

  test('reads --interactive from its environment variable', async () => {
    vi.mocked(interactiveSecurityReview).mockReturnValue(vi.fn())
    vi.stubEnv('SHOPIFY_FLAG_APP_SECURITY_INTERACTIVE', '1')
    try {
      await SecurityReview.run([], import.meta.url)
    } finally {
      vi.unstubAllEnvs()
    }

    expect(interactiveSecurityReview).toHaveBeenCalledOnce()
  })

  test('starts no session without --interactive', async () => {
    await SecurityReview.run(['--json'], import.meta.url)
    await SecurityReview.run(['--suppress', '1', '--kind', 'false-positive', '--reason', 'r'], import.meta.url)

    expect(interactiveSecurityReview).not.toHaveBeenCalled()
    for (const [options] of vi.mocked(securityReview).mock.calls) expect(options).not.toHaveProperty('interactive')
  })

  test('fails before it reviews anything when the session cannot prompt', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(interactiveSecurityReview).mockImplementation(() => {
      throw new AbortError('The interactive review needs an interactive terminal.')
    })
    try {
      await expect(SecurityReview.run(['--interactive'], import.meta.url)).rejects.toThrow(
        /process.exit unexpectedly called/,
      )

      expect(outputMock.error()).toContain('The interactive review needs an interactive terminal.')
      expect(securityReview).not.toHaveBeenCalled()
    } finally {
      outputMock.clear()
    }
  })

  test.each([
    ['--json', ['--interactive', '--json']],
    ['-j', ['--interactive', '-j']],
    ['--suppress', ['--interactive', '--suppress', '1', '--kind', 'false-positive', '--reason', 'r']],
  ])('refuses --interactive with %s, so it never prompts there', async (_flag, argv) => {
    await expect(parseError(argv)).resolves.toMatch(
      /--(json|suppress)=\S+ cannot also be provided when using --interactive/,
    )
  })
})
