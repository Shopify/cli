import {encodeSecuritySubmitJson, toSecuritySubmitJson, securitySubmitJsonOutputSchema} from './security-submit-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {SecuritySubmitResult} from './security-submit-result.js'

const payload = {path: '<APP_ROOT>/.shopify/app-security/submission.json', schemaVersion: 1 as const}
const submittedAt = '2026-09-01T09:30:00.000Z'

describe('App Security submit JSON', () => {
  test('represents declined confirmation as an explicit successful cancellation', () => {
    expect(JSON.parse(encodeSecuritySubmitJson(toSecuritySubmitJson({status: 'cancelled'})))).toEqual({
      status: 'cancelled',
      operation: 'submit',
    })
  })

  test('normalizes submission timestamps and rejects accidental CLI fields', () => {
    const result = toSecuritySubmitJson({
      status: 'submitted',
      payload,
      submittedAt: '2026-09-01T11:30:00+02:00',
      appTitle: 'Example',
      clientId: 'client',
    })
    expect(JSON.parse(encodeSecuritySubmitJson(result)).submittedAt).toBe('2026-09-01T09:30:00.000Z')
    expect(() => securitySubmitJsonOutputSchema.validate({...result, accidentalField: true})).toThrow()
  })
  test.each([
    {result: {status: 'dry-run', payload}, fixture: 'security-submit-dry-run-result.json'},
    {
      result: {status: 'submitted', payload, submittedAt, appTitle: 'Example app', clientId: 'example-client-id'},
      fixture: 'security-submit-result.json',
    },
  ] satisfies {result: Exclude<SecuritySubmitResult, {status: 'cancelled'}>; fixture: string}[])(
    'preserves the exact $fixture success shape',
    async ({result, fixture}) => {
      const fixturePath = joinPath(
        moduleDirectory(import.meta.url),
        'app-security-engine',
        'tests',
        'fixtures',
        fixture,
      )
      const expectedJson = (await readFile(fixturePath)).replaceAll('\r\n', '\n').trimEnd()
      expect(encodeSecuritySubmitJson(toSecuritySubmitJson(result))).toBe(expectedJson)
    },
  )

  test.each([false, true])('retains complete user errors, order, and accepted=%s', (accepted) => {
    const userErrors = [
      {message: 'First error', field: ['sourceScanUrl']},
      {message: 'Second error', field: null},
    ]
    expect(
      toSecuritySubmitJson({
        status: 'failed',
        error: {stage: 'create', message: 'First error, Second error', userErrors, accepted, tryMessage: 'Retry.'},
      }),
    ).toEqual({
      error: {
        type: 'abort',
        message: 'First error, Second error',
        tryMessage: 'Retry.',
        details: {stage: 'create', userErrors, accepted},
      },
    })
  })

  test('local failures do not invent API response fields', () => {
    expect(toSecuritySubmitJson({status: 'failed', error: {stage: 'preparation', message: 'Missing trace'}})).toEqual({
      error: {type: 'abort', message: 'Missing trace', details: {stage: 'preparation'}},
    })
  })

  test('converts formatted recovery tokens to plain strings without ANSI codes', () => {
    const result = toSecuritySubmitJson({
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

    expect(JSON.parse(encodeSecuritySubmitJson(result))).toEqual({
      error: {
        type: 'abort',
        message: 'Missing target',
        tryMessage: 'Pass --client-id <client-id>.',
        nextSteps: ['Select an existing config with --config <name>.', 'See configuration docs', 'Try again.'],
        details: {stage: 'preparation'},
      },
    })
  })

  test.each([undefined, null])('omits absent recovery guidance (tryMessage=%s)', (tryMessage) => {
    expect(
      toSecuritySubmitJson({
        status: 'failed',
        error: {stage: 'preparation', message: 'Missing trace', tryMessage, nextSteps: undefined},
      }),
    ).toEqual({error: {type: 'abort', message: 'Missing trace', details: {stage: 'preparation'}}})
  })

  test('retains an explicitly empty next steps list', () => {
    expect(
      toSecuritySubmitJson({
        status: 'failed',
        error: {stage: 'preparation', message: 'Missing trace', nextSteps: []},
      }),
    ).toEqual({error: {type: 'abort', message: 'Missing trace', nextSteps: [], details: {stage: 'preparation'}}})
  })

  test('upload URL failures retain empty errors without adding an accepted state', () => {
    expect(
      toSecuritySubmitJson({status: 'failed', error: {stage: 'upload-url', message: 'Missing URL', userErrors: []}}),
    ).toEqual({error: {type: 'abort', message: 'Missing URL', details: {stage: 'upload-url', userErrors: []}}})
  })
})
