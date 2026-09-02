import DoctorSubmit from './submit.js'
import {appFlags} from '../../../flags.js'
import doctorSubmit from '../../../services/doctor-submit.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/doctor-submit.js')
vi.mock('@shopify/cli-kit/node/system')

describe('app doctor submit command', () => {
  beforeEach(() => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  })

  test('is hidden and lets the service link only after trace validation', () => {
    expect(DoctorSubmit.hidden).toBe(true)
    expect(DoctorSubmit.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorSubmit.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorSubmit.flags.path).toBe(appFlags.path)
    expect(DoctorSubmit.flags.config).toBe(appFlags.config)
    expect(DoctorSubmit.flags['client-id']).toBe(appFlags['client-id'])
    expect(DoctorSubmit.args).not.toHaveProperty('directory')
    expect(DoctorSubmit.descriptionWithMarkdown).toContain(
      'No source code, file paths, snippets, or commit identifiers are sent',
    )
    expect(DoctorSubmit.descriptionWithMarkdown).toContain('--version')
    expect(DoctorSubmit.descriptionWithMarkdown).toContain('--source-control-url')
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
      sourceControlUrl: undefined,
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
        '--source-control-url',
        'https://github.com/example/app/tree/v1.2.3',
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
      sourceControlUrl: 'https://github.com/example/app/tree/v1.2.3',
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
      sourceControlUrl: undefined,
    })
  })

  test('fails at parse time in a non-interactive terminal without --force', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    await expect(DoctorSubmit.run([], import.meta.url)).rejects.toThrow()
    expect(doctorSubmit).not.toHaveBeenCalled()
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
    expect(DoctorSubmit.flags['source-control-url'].env).toBe('SHOPIFY_FLAG_SOURCE_CONTROL_URL')
  })
})
