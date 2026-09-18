import DoctorRecord from './record.js'
import {appFlags} from '../../../flags.js'
import {recordAppDoctorReview, writeAppDoctorRecordResult} from '../../../services/app-doctor-record.js'
import {appDoctorRecordJsonOutputSchema} from '../../../services/app-doctor-record-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorRecordResult} from '../../../services/app-doctor-record-json.js'

vi.mock('../../../services/app-doctor-record.js')
vi.mock('@shopify/cli-kit/node/context/local')

const result: AppDoctorRecordResult = {
  schema_version: 1,
  configuration: {identity: 'identity', path: '/app/shopify.app.toml', name: 'shopify.app.toml'},
  app_root: '/app',
  recorded: [],
  summary: {
    scopes: 0,
    findings: 0,
    suppressed_findings: 0,
    score: {status: 'withheld', reason: 'no_static_results'},
    static_coverage_complete: false,
  },
  diagnostics: [],
  next: 'shopify app doctor status --path /app --config shopify.app.toml',
}

function arrange(interactive: boolean) {
  vi.mocked(isTerminalInteractive).mockReturnValue(interactive)
  vi.mocked(recordAppDoctorReview).mockResolvedValue(result)
}

describe('app doctor record command', () => {
  test('is hidden, exposes the JSON contract, and does not require linked app context', () => {
    expect(DoctorRecord.hidden).toBe(true)
    expect(DoctorRecord.prototype).toBeInstanceOf(BaseCommand)
    expect(DoctorRecord.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(DoctorRecord.flags.path).toBe(appFlags.path)
    expect(DoctorRecord.flags.config).toBe(appFlags.config)
    expect(DoctorRecord.flags['client-id']).toBe(appFlags['client-id'])
    expect(DoctorRecord.flags.json).toBeDefined()
    expect(DoctorRecord.flags.review).toMatchObject({multiple: true, required: true})
    expect(DoctorRecord.flags.findings).toMatchObject({multiple: true, required: true})
    expect(DoctorRecord.flags.review.env).toBe('SHOPIFY_FLAG_APP_DOCTOR_RECORD_REVIEW')
    expect(DoctorRecord.flags.findings.env).toBe('SHOPIFY_FLAG_APP_DOCTOR_RECORD_FINDINGS')
    expect(DoctorRecord.jsonOutputSchema).toBe(appDoctorRecordJsonOutputSchema)
  })

  test('forwards paired --review/--findings flags in order and writes text by default', async () => {
    arrange(true)

    await DoctorRecord.run(
      [
        '--path',
        './fixtures/app',
        '--config',
        'staging',
        '--review',
        'tok-a',
        '--findings',
        'a.json',
        '--review',
        'tok-b',
        '--findings',
        './b.json',
      ],
      import.meta.url,
    )

    expect(recordAppDoctorReview).toHaveBeenCalledWith({
      directory: resolvePath('./fixtures/app'),
      configName: 'staging',
      clientId: undefined,
      reviews: ['tok-a', 'tok-b'],
      findings: [resolvePath('a.json'), resolvePath('./b.json')],
      interactive: true,
    })
    expect(writeAppDoctorRecordResult).toHaveBeenCalledWith(result, 'text')
  })

  test('writes JSON when --json is passed and reports non-interactive terminals', async () => {
    arrange(false)

    await DoctorRecord.run(['--review', 'tok', '--findings', 'f.json', '--json'], import.meta.url)

    expect(recordAppDoctorReview).toHaveBeenCalledWith(expect.objectContaining({interactive: false}))
    expect(writeAppDoctorRecordResult).toHaveBeenCalledWith(result, 'json')
  })
})
