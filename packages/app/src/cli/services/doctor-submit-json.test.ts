import {encodeDoctorSubmitJson, toDoctorSubmitJson} from './doctor-submit-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {DoctorSubmitResult} from './doctor-submit-result.js'

const payload = {path: '<APP_ROOT>/.shopify/app-doctor/submission.json', schemaVersion: 1 as const}
const submittedAt = '2026-09-01T09:30:00.000Z'

describe('App Doctor submit JSON', () => {
  test.each([
    {result: {status: 'dry-run', payload}, fixture: 'doctor-submit-dry-run-result.json'},
    {
      result: {status: 'submitted', payload, submittedAt, appTitle: 'Example app'},
      fixture: 'doctor-submit-result.json',
    },
  ] satisfies {result: Exclude<DoctorSubmitResult, {status: 'cancelled'}>; fixture: string}[])(
    'preserves the exact $fixture success shape',
    async ({result, fixture}) => {
      const fixturePath = joinPath(moduleDirectory(import.meta.url), 'app-doctor-engine', 'tests', 'fixtures', fixture)
      const expectedJson = (await readFile(fixturePath)).replaceAll('\r\n', '\n').trimEnd()
      expect(encodeDoctorSubmitJson(toDoctorSubmitJson(result))).toBe(expectedJson)
    },
  )

  test.each([false, true])('retains complete user errors, order, and accepted=%s', (accepted) => {
    const userErrors = [
      {message: 'First error', field: ['sourceScanUrl']},
      {message: 'Second error', field: null},
    ]
    expect(
      toDoctorSubmitJson({
        status: 'failed',
        error: {stage: 'create', message: 'First error, Second error', userErrors, accepted, tryMessage: 'Retry.'},
      }),
    ).toEqual({
      operation: 'submit',
      error: {
        stage: 'create',
        message: 'First error, Second error',
        user_errors: userErrors,
        accepted,
        try_message: 'Retry.',
      },
    })
  })

  test('local failures do not invent API response fields', () => {
    expect(toDoctorSubmitJson({status: 'failed', error: {stage: 'preparation', message: 'Missing trace'}})).toEqual({
      operation: 'submit',
      error: {stage: 'preparation', message: 'Missing trace'},
    })
  })

  test('converts formatted recovery tokens to plain strings without ANSI codes', () => {
    const result = toDoctorSubmitJson({
      status: 'failed',
      error: {
        stage: 'preparation',
        message: 'Missing target',
        tryMessage: ['Pass', {command: '\u001b[36m--client-id <client-id>\u001b[0m'}, {char: '.'}],
        nextSteps: [
          ['Select', {bold: 'an existing config'}, 'with', {command: '--config <name>'}, {char: '.'}],
          ['See', {link: {label: 'configuration docs', url: 'https://shopify.dev/docs/apps'}}],
          '\u001b[31mTry again.\u001b[0m',
        ],
      },
    })

    expect(JSON.parse(encodeDoctorSubmitJson(result))).toEqual({
      operation: 'submit',
      error: {
        stage: 'preparation',
        message: 'Missing target',
        try_message: 'Pass --client-id <client-id>.',
        next_steps: ['Select an existing config with --config <name>.', 'See configuration docs', 'Try again.'],
      },
    })
  })

  test.each([undefined, null])('omits absent recovery guidance (tryMessage=%s)', (tryMessage) => {
    expect(
      toDoctorSubmitJson({
        status: 'failed',
        error: {stage: 'preparation', message: 'Missing trace', tryMessage, nextSteps: undefined},
      }),
    ).toEqual({operation: 'submit', error: {stage: 'preparation', message: 'Missing trace'}})
  })

  test('retains an explicitly empty next steps list', () => {
    expect(
      toDoctorSubmitJson({
        status: 'failed',
        error: {stage: 'preparation', message: 'Missing trace', nextSteps: []},
      }),
    ).toEqual({operation: 'submit', error: {stage: 'preparation', message: 'Missing trace', next_steps: []}})
  })

  test('upload URL failures retain empty errors without adding an accepted state', () => {
    expect(
      toDoctorSubmitJson({status: 'failed', error: {stage: 'upload-url', message: 'Missing URL', userErrors: []}}),
    ).toEqual({operation: 'submit', error: {stage: 'upload-url', message: 'Missing URL', user_errors: []}})
  })
})
