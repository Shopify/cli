import {validateApp} from './validate.js'
import {testAppLinked} from '../models/app/app.test-data.js'
import {AppErrors, formatConfigurationError} from '../models/app/loader.js'
import {describe, expect, test, vi} from 'vitest'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/ui')

describe('formatConfigurationError', () => {
  test('returns plain message when no path', () => {
    expect(formatConfigurationError({file: 'foo.toml', message: 'something broke'})).toBe('something broke')
  })

  test('includes field path when present', () => {
    expect(formatConfigurationError({file: 'foo.toml', path: ['access', 'admin'], message: 'Required'})).toBe(
      '[access.admin]: Required',
    )
  })
})

describe('validateApp', () => {
  test('renders success when there are no errors', async () => {
    const app = testAppLinked()
    await validateApp(app)
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'App configuration is valid.'})
    expect(renderError).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs json success when --json is enabled and there are no errors', async () => {
    const app = testAppLinked()
    await validateApp(app, {json: true})
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({valid: true, issues: []}, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderError).not.toHaveBeenCalled()
  })

  test('renders errors and throws when there are validation errors', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', message: 'client_id is required'})
    errors.addError({file: '/path/to/extensions/my-ext/shopify.extension.toml', message: 'invalid type "unknown"'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app)).rejects.toThrow(AbortSilentError)
    expect(renderError).toHaveBeenCalledWith({
      headline: 'Validation errors found.',
      body: expect.stringContaining('client_id is required'),
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs structured json issues when --json is enabled and there are validation errors', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', message: 'client_id is required'})
    errors.addError({file: '/path/to/extensions/my-ext/shopify.extension.toml', message: 'invalid type "unknown"'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {file: '/path/to/shopify.app.toml', message: 'client_id is required'},
            {file: '/path/to/extensions/my-ext/shopify.extension.toml', message: 'invalid type "unknown"'},
          ],
        },
        null,
        2,
      ),
    )
    expect(renderError).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success when errors object exists but is empty', async () => {
    const errors = new AppErrors()
    const app = testAppLinked()
    app.errors = errors
    await validateApp(app)
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'App configuration is valid.'})
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('includes path and code in structured json issues', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', path: ['name'], message: 'Required', code: 'invalid_type'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [{file: '/path/to/shopify.app.toml', message: 'Required', path: ['name'], code: 'invalid_type'}],
        },
        null,
        2,
      ),
    )
  })
})
