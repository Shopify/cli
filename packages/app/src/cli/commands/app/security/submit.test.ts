import SecuritySubmit from './submit.js'
import {appFlags} from '../../../flags.js'
import securitySubmit from '../../../services/security-submit.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import * as output from '@shopify/cli-kit/node/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-submit.js')
vi.mock('@shopify/cli-kit/node/system')

describe('app security submit command', () => {
  let previousExitCode: typeof process.exitCode
  beforeEach(() => {
    previousExitCode = process.exitCode
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(securitySubmit).mockResolvedValue({status: 'cancelled'})
  })

  afterEach(() => {
    process.exitCode = previousExitCode
  })

  test('is hidden and lets the service link only after trace validation', () => {
    expect(SecuritySubmit.hidden).toBe(true)
    expect(SecuritySubmit.prototype).toBeInstanceOf(BaseCommand)
    expect(SecuritySubmit.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecuritySubmit.flags.path).toBe(appFlags.path)
    expect(SecuritySubmit.flags.config).toBe(appFlags.config)
    expect(SecuritySubmit.flags['client-id']).toBe(appFlags['client-id'])
    expect(SecuritySubmit.args).not.toHaveProperty('directory')
    expect(SecuritySubmit.descriptionWithMarkdown).toContain('Generated report fields exclude source code, file paths')
    expect(SecuritySubmit.descriptionWithMarkdown).toContain('Optional feedback is included without redaction')
    expect(SecuritySubmit.descriptionWithMarkdown).not.toContain(
      'No source code, file paths, snippets, or commit identifiers are sent',
    )
    expect(SecuritySubmit.descriptionWithMarkdown).toContain('--version')
    expect(SecuritySubmit.descriptionWithMarkdown).not.toContain('--source-control-url')
  })

  test('describes the optional app version corresponding to the scanned files', () => {
    expect(SecuritySubmit.flags.version.description).toBe(
      'Optional app version corresponding to the files used to generate these results.',
    )
  })

  test('does not offer a source-control URL or hash flag', () => {
    expect(SecuritySubmit.flags).not.toHaveProperty('source-control-url')
    expect(SecuritySubmit.flags).not.toHaveProperty('source-control-hash')
  })

  test('forwards defaults from the current directory', async () => {
    await SecuritySubmit.run([], import.meta.url)

    expect(securitySubmit).toHaveBeenCalledWith({
      directory: cwd(),
      json: false,
      force: false,
      dryRun: false,
      clientId: undefined,
      configName: undefined,
      versionTag: undefined,
      feedback: undefined,
    })
  })

  test('forwards submit flags with --client-id', async () => {
    await SecuritySubmit.run(
      [
        '--path',
        './fixtures/app',
        '--client-id',
        'client-id',
        '--json',
        '--force',
        '--dry-run',
        '--version',
        'v1.2.3',
        '--feedback',
        'The authorization result was inaccurate.',
      ],
      import.meta.url,
    )

    expect(securitySubmit).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/app'),
      json: true,
      force: true,
      dryRun: true,
      clientId: 'client-id',
      configName: undefined,
      versionTag: 'v1.2.3',
      feedback: 'The authorization result was inaccurate.',
    })
  })

  test('forwards --config separately because --config and --client-id are exclusive', async () => {
    await SecuritySubmit.run(['--config', 'staging'], import.meta.url)

    expect(securitySubmit).toHaveBeenCalledWith({
      directory: cwd(),
      json: false,
      force: false,
      dryRun: false,
      clientId: undefined,
      configName: 'staging',
      versionTag: undefined,
      feedback: undefined,
    })
  })

  test('fails at parse time in a non-interactive terminal without --force', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      process.exitCode = code ?? 0
      return undefined as never
    })
    try {
      await SecuritySubmit.run([], import.meta.url)

      expect(exit).toHaveBeenCalledExactlyOnceWith(1)
      expect(process.exitCode).toBe(1)
      expect(securitySubmit).not.toHaveBeenCalled()
    } finally {
      exit.mockRestore()
    }
  })

  test.each([false, true])('renders the service missing-force guard as JSON (TTY=%s)', async (tty) => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(tty)
    vi.mocked(securitySubmit).mockRejectedValue(new AbortError('Pass --force to submit without confirmation.'))
    const resultOutput = vi.spyOn(output, 'outputResult')
    try {
      await SecuritySubmit.run(['--json'], import.meta.url)

      expect(securitySubmit).toHaveBeenCalledWith(expect.objectContaining({json: true, force: false, dryRun: false}))
      expect(process.exitCode).toBe(1)
      expect(resultOutput).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify(
          {
            operation: 'submit',
            error: {message: 'Pass --force to submit without confirmation.', stage: 'preparation'},
          },
          null,
          2,
        ),
      )
    } finally {
      resultOutput.mockRestore()
    }
  })

  test('formats API failure data as JSON and sets a failing exit status', async () => {
    const userErrors = [{message: 'Rejected scan', field: ['sourceScanUrl']}]
    vi.mocked(securitySubmit).mockResolvedValue({
      status: 'failed',
      error: {stage: 'create', message: 'Rejected scan', userErrors, accepted: true},
    })
    const resultOutput = vi.spyOn(output, 'outputResult')
    try {
      await SecuritySubmit.run(['--json', '--force'], import.meta.url)

      expect(process.exitCode).toBe(1)
      expect(resultOutput).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify(
          {
            operation: 'submit',
            error: {message: 'Rejected scan', stage: 'create', user_errors: userErrors, accepted: true},
          },
          null,
          2,
        ),
      )
    } finally {
      resultOutput.mockRestore()
    }
  })

  test('allows --dry-run in a non-interactive terminal without --force', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    await SecuritySubmit.run(['--json', '--dry-run'], import.meta.url)

    expect(securitySubmit).toHaveBeenCalledWith(expect.objectContaining({json: true, dryRun: true, force: false}))
  })

  test('uses the established flag aliases and environment variables', () => {
    expect(SecuritySubmit.flags.force.char).toBe('f')
    expect(SecuritySubmit.flags.force.env).toBe('SHOPIFY_FLAG_FORCE')
    expect(SecuritySubmit.flags['dry-run'].env).toBe('SHOPIFY_FLAG_APP_SECURITY_DRY_RUN')
    expect(SecuritySubmit.flags.version.env).toBe('SHOPIFY_FLAG_VERSION')
    expect(SecuritySubmit.flags.feedback.env).toBe('SHOPIFY_FLAG_APP_SECURITY_FEEDBACK')
  })
})
