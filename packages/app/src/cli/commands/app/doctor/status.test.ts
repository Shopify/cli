import DoctorStatus from './status.js'
import {appFlags} from '../../../flags.js'
import {getAppDoctorStatus, writeAppDoctorStatusResult} from '../../../services/app-doctor-status.js'
import {appDoctorStatusJsonOutputSchema} from '../../../services/app-doctor-status-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorStatusResult} from '../../../services/app-doctor-status-json.js'

vi.mock('../../../services/app-doctor-status.js')
vi.mock('@shopify/cli-kit/node/context/local')

const result: AppDoctorStatusResult = {
  schema_version: 1,
  basis: 'stored-results',
  configuration: {identity: 'identity', path: '/app/shopify.app.toml', name: 'shopify.app.toml'},
  app_root: '/app',
  store: {directory: '/app/.shopify/app-doctor/store', state: 'missing'},
  scopes: [],
  findings: [],
  coverage: {
    static_result_count: 0,
    complete: false,
    files_skipped: 0,
    unsupported_languages: [],
    gaps: [],
    owners: [],
  },
  score: {status: 'withheld', reason: 'no_static_results'},
  suppressions: {matched: 0, suppressed_findings: 0, unmatched: []},
  diagnostics: [],
}

function arrange(interactive: boolean) {
  vi.mocked(isTerminalInteractive).mockReturnValue(interactive)
  vi.mocked(getAppDoctorStatus).mockResolvedValue(result)
}

describe('app doctor status command', () => {
  test('is hidden, exposes the JSON contract, and does not require linked app context', () => {
    expect(DoctorStatus.hidden).toBe(true)
    expect(DoctorStatus.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorStatus.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorStatus.flags.path).toBe(appFlags.path)
    expect(DoctorStatus.flags.config).toBe(appFlags.config)
    expect(DoctorStatus.flags['client-id']).toBe(appFlags['client-id'])
    expect(DoctorStatus.flags.json).toBeDefined()
    expect(DoctorStatus.jsonOutputSchema).toBe(appDoctorStatusJsonOutputSchema)
    expect(DoctorStatus.description).toContain('No scan is performed')
  })

  test('forwards the selection flags and writes text by default', async () => {
    arrange(true)

    await DoctorStatus.run(['--path', './fixtures/app', '--config', 'staging'], import.meta.url)

    expect(getAppDoctorStatus).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/app'),
      configName: 'staging',
      clientId: undefined,
      interactive: true,
    })
    expect(writeAppDoctorStatusResult).toHaveBeenCalledWith(result, 'text')
  })

  test('writes JSON when --json is passed and reports non-interactive terminals', async () => {
    arrange(false)

    await DoctorStatus.run(['--client-id', 'abc', '--json'], import.meta.url)

    expect(getAppDoctorStatus).toHaveBeenCalledWith(expect.objectContaining({clientId: 'abc', interactive: false}))
    expect(writeAppDoctorStatusResult).toHaveBeenCalledWith(result, 'json')
  })
})
