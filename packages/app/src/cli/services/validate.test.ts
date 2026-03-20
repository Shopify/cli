import {validateApp} from './validate.js'
import {testAppLinked} from '../models/app/app.test-data.js'
import {AppErrors} from '../models/app/loader.js'
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

describe('validateApp', () => {
  test('renders success when there are no errors', async () => {
    // Given
    const app = testAppLinked()

    // When
    await validateApp(app)

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'App configuration is valid.'})
    expect(renderError).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs json success when --json is enabled and there are no errors', async () => {
    // Given
    const app = testAppLinked()

    // When
    await validateApp(app, {json: true})

    // Then
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({valid: true, errors: []}, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderError).not.toHaveBeenCalled()
  })

  test('renders errors and throws when there are validation errors', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('/path/to/shopify.app.toml', 'client_id is required')
    errors.addError('/path/to/extensions/my-ext/shopify.extension.toml', 'invalid type "unknown"')
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app)).rejects.toThrow(AbortSilentError)
    expect(renderError).toHaveBeenCalledWith({
      headline: 'Validation errors found.',
      body: expect.stringContaining('client_id is required'),
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs json errors and throws when --json is enabled and there are validation errors', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('/path/to/shopify.app.toml', 'client_id is required')
    errors.addError('/path/to/extensions/my-ext/shopify.extension.toml', 'invalid type "unknown"')
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          errors: ['client_id is required', 'invalid type "unknown"'],
        },
        null,
        2,
      ),
    )
    expect(renderError).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success when errors object exists but is empty', async () => {
    // Given
    const errors = new AppErrors()
    const app = testAppLinked()
    app.errors = errors

    // When
    await validateApp(app)

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'App configuration is valid.'})
    expect(outputResult).not.toHaveBeenCalled()
  })
})
