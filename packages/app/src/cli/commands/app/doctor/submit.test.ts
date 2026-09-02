import DoctorSubmit from './submit.js'
import {appFlags} from '../../../flags.js'
import doctorSubmit from '../../../services/doctor-submit.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import * as output from '@shopify/cli-kit/node/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/doctor-submit.js')
vi.mock('@shopify/cli-kit/node/system')

describe('app doctor submit command', () => {
  let previousExitCode: typeof process.exitCode
  beforeEach(() => {
    previousExitCode = process.exitCode
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(doctorSubmit).mockResolvedValue({status: 'cancelled'})
  })

  afterEach(() => {
    process.exitCode = previousExitCode
  })

  test('is hidden and lets the service link only after trace validation', () => {
    expect(DoctorSubmit.hidden).toBe(true)
    expect(DoctorSubmit.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorSubmit.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorSubmit.flags.path).toBe(appFlags.path)
    expect(DoctorSubmit.flags.config).toBe(appFlags.config)
    expect(DoctorSubmit.flags['client-id']).toBe(appFlags['client-id'])
    expect(DoctorSubmit.args).not.toHaveProperty('directory')
    expect(DoctorSubmit.descriptionWithMarkdown).toContain('Generated report fields exclude source code, file paths')
    expect(DoctorSubmit.descriptionWithMarkdown).toContain('Optional feedback is included without redaction')
    expect(DoctorSubmit.descriptionWithMarkdown).not.toContain(
      'No source code, file paths, snippets, or commit identifiers are sent',
    )
    expect(DoctorSubmit.descriptionWithMarkdown).toContain('--version')
    expect(DoctorSubmit.descriptionWithMarkdown).not.toContain('--source-control-url')
  })

  test('describes the optional app version corresponding to the scanned files', () => {
    expect(DoctorSubmit.flags.version.description).toBe(
      'Optional app version corresponding to the files used to generate these results.',
    )
  })

  test('does not offer a source-control URL or hash flag', () => {
    expect(DoctorSubmit.flags).not.toHaveProperty('source-control-url')
    expect(DoctorSubmit.flags).not.toHaveProperty('source-control-hash')
  })

  test('forwards defaults from the current directory', async () => {
    await DoctorSubmit.run([], import.meta.url)

    expect(doctorSubmit).toHaveBeenCalledWith({
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
    await DoctorSubmit.run(
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

    expect(doctorSubmit).toHaveBeenCalledWith({
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
    await DoctorSubmit.run(['--config', 'staging'], import.meta.url)

    expect(doctorSubmit).toHaveBeenCalledWith({
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
      await DoctorSubmit.run([], import.meta.url)

      expect(exit).toHaveBeenCalledExactlyOnceWith(1)
      expect(process.exitCode).toBe(1)
      expect(doctorSubmit).not.toHaveBeenCalled()
    } finally {
      exit.mockRestore()
    }
  })

  test.each([false, true])('renders the service missing-force guard as JSON (TTY=%s)', async (tty) => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(tty)
    vi.mocked(doctorSubmit).mockRejectedValue(new AbortError('Pass --force to submit without confirmation.'))
    const resultOutput = vi.spyOn(output, 'outputResult')
    try {
      await DoctorSubmit.run(['--json'], import.meta.url)

      expect(doctorSubmit).toHaveBeenCalledWith(expect.objectContaining({json: true, force: false, dryRun: false}))
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
    vi.mocked(doctorSubmit).mockResolvedValue({
      status: 'failed',
      error: {stage: 'create', message: 'Rejected scan', userErrors, accepted: true},
    })
    const resultOutput = vi.spyOn(output, 'outputResult')
    try {
      await DoctorSubmit.run(['--json', '--force'], import.meta.url)

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

    await DoctorSubmit.run(['--json', '--dry-run'], import.meta.url)

    expect(doctorSubmit).toHaveBeenCalledWith(expect.objectContaining({json: true, dryRun: true, force: false}))
  })

  test('uses the established flag aliases and environment variables', () => {
    expect(DoctorSubmit.flags.force.char).toBe('f')
    expect(DoctorSubmit.flags.force.env).toBe('SHOPIFY_FLAG_FORCE')
    expect(DoctorSubmit.flags['dry-run'].env).toBe('SHOPIFY_FLAG_APP_DOCTOR_DRY_RUN')
    expect(DoctorSubmit.flags.version.env).toBe('SHOPIFY_FLAG_VERSION')
    expect(DoctorSubmit.flags.feedback.env).toBe('SHOPIFY_FLAG_APP_DOCTOR_FEEDBACK')
  })
})
