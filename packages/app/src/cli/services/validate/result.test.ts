import {renderAppConfigValidateResult} from './result.js'
import {appConfigValidateJsonOutputSchema} from './types.js'
import {describe, expect, test, vi} from 'vitest'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const cases = [
  {valid: true, issues: []},
  {valid: false, issues: [{filePath: null, message: 'No config found', fieldPath: null, code: null}]},
  {valid: false, issues: [{filePath: '/app/shopify.app.toml', message: 'Invalid TOML', fieldPath: null, code: null}]},
  {
    valid: false,
    issues: [{filePath: '/app/shopify.app.toml', message: 'Required', fieldPath: ['name'], code: 'invalid_type'}],
  },
]

describe('validation contract', () => {
  test.each([
    {valid: true, issues: [], extra: true},
    {valid: false, issues: [{filePath: '/app/config', message: 'Error', fieldPath: null, code: null, extra: true}]},
  ])('rejects unknown fields %j', (result) => {
    expect(() => appConfigValidateJsonOutputSchema.validate(result)).toThrow()
  })

  test.each(cases)('preserves exact JSON for %j', (result) => {
    expect(appConfigValidateJsonOutputSchema.encode(result)).toBe(JSON.stringify(result, null, 2))
  })

  test.each([
    {valid: 'true', issues: []},
    {valid: true, issues: [{message: 123}]},
    {valid: false, issues: [{message: 'Required', fieldPath: [false]}]},
    {valid: false, issues: [{message: 'Required', code: null}]},
  ])('rejects malformed data %j', (result) => {
    expect(() => appConfigValidateJsonOutputSchema.validate(result)).toThrow()
  })

  test.each(cases)('writes exactly one result and routes diagnostics separately for %j', async (result) => {
    await withCapturedStandardStreams((streams) => {
      runWithCommandEventsForCommand(['--json'], () => {
        outputInfo('Checking configuration')
        renderAppConfigValidateResult(result, '/app/shopify.app.toml', 'json')
      })

      expect(streams.stdout()).toBe(`${JSON.stringify(result, null, 2)}\n`)
      expect(JSON.parse(streams.stderr())).toMatchObject({type: 'diagnostic', message: 'Checking configuration'})
    })
  })
})

describe('renderAppConfigValidateResult in text mode', () => {
  test('renders a success message with the config file name', () => {
    renderAppConfigValidateResult({valid: true, issues: []}, '/app/shopify.app.toml', 'text')

    expect(renderSuccess).toHaveBeenCalledWith({headline: "App configuration 'shopify.app.toml' is valid."})
    expect(renderError).not.toHaveBeenCalled()
  })

  test('renders formatted issues without throwing when the result is invalid', () => {
    const result = {
      valid: false,
      issues: [
        {filePath: '/app/shopify.app.toml', message: 'client_id is required', fieldPath: null, code: null},
        {filePath: '/app/shopify.app.toml', fieldPath: ['name'], message: 'Required', code: 'invalid_type'},
      ],
    }

    expect(() => renderAppConfigValidateResult(result, '/app/shopify.app.toml', 'text')).not.toThrow()

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Validation errors found.',
      body: '• client_id is required\n• [name]: Required',
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('falls back to the validated config path when an issue has no file', () => {
    const result = {
      valid: false,
      issues: [
        {filePath: null, fieldPath: ['events', '1', 'metrics'], message: 'Expected object, received array', code: null},
      ],
    }

    renderAppConfigValidateResult(result, '/app/shopify.app.toml', 'text')

    // The TOML table hint only applies to .toml files, so it proves the configPath fallback was used.
    expect(renderError).toHaveBeenCalledWith({
      headline: 'Validation errors found.',
      body: expect.stringContaining('Use a TOML table instead of an array.'),
    })
  })
})
