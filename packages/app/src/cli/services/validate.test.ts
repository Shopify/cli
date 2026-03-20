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
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({valid: true, issues: []}, null, 2))
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
      body: 'client_id is required\n\ninvalid type "unknown"',
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('outputs structured json issues and throws when --json is enabled and there are validation errors', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError(
      '/path/to/shopify.app.toml',
      'App configuration is not valid\nValidation errors in /path/to/shopify.app.toml:\n\n• [client_id]: Required',
      [
        {
          filePath: '/path/to/shopify.app.toml',
          path: ['client_id'],
          pathString: 'client_id',
          message: 'Required',
          code: 'invalid_type',
        },
      ],
    )
    errors.addError('/path/to/extensions/my-ext/shopify.extension.toml', 'invalid type "unknown"')
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/path/to/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: '/path/to/extensions/my-ext/shopify.extension.toml',
              path: [],
              pathString: 'root',
              message: 'invalid type "unknown"',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(renderError).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('flattens multiple structured issues across files in json mode', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError(
      '/path/to/shopify.app.toml',
      'Validation errors in /path/to/shopify.app.toml:\n\n• [client_id]: Required\n• [name]: Must be set',
      [
        {
          filePath: '/path/to/shopify.app.toml',
          path: ['client_id'],
          pathString: 'client_id',
          message: 'Required',
          code: 'invalid_type',
        },
        {
          filePath: '/path/to/shopify.app.toml',
          path: ['name'],
          pathString: 'name',
          message: 'Must be set',
          code: 'custom',
        },
      ],
    )
    errors.addError(
      '/path/to/extensions/my-ext/shopify.extension.toml',
      'Validation errors in /path/to/extensions/my-ext/shopify.extension.toml:\n\n• [targeting.0.target]: Invalid target',
      [
        {
          filePath: '/path/to/extensions/my-ext/shopify.extension.toml',
          path: ['targeting', 0, 'target'],
          pathString: 'targeting.0.target',
          message: 'Invalid target',
          code: 'custom',
        },
      ],
    )
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/path/to/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: '/path/to/shopify.app.toml',
              path: ['name'],
              pathString: 'name',
              message: 'Must be set',
              code: 'custom',
            },
            {
              filePath: '/path/to/extensions/my-ext/shopify.extension.toml',
              path: ['targeting', 0, 'target'],
              pathString: 'targeting.0.target',
              message: 'Invalid target',
              code: 'custom',
            },
          ],
        },
        null,
        2,
      ),
    )
  })

  test('preserves structured issues and appends a root issue for same-file unstructured follow-up errors', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('tmp/shopify.app.toml', 'Validation errors in tmp/shopify.app.toml:\n\n• [client_id]: Required', [
      {
        filePath: 'tmp/shopify.app.toml',
        path: ['client_id'],
        pathString: 'client_id',
        message: 'Required',
        code: 'invalid_type',
      },
    ])
    errors.addError('tmp/shopify.app.toml', 'Could not infer extension handle from configuration')
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: 'tmp/shopify.app.toml',
              path: [],
              pathString: 'root',
              message: 'Could not infer extension handle from configuration',
            },
          ],
        },
        null,
        2,
      ),
    )
  })

  test('outputs json success when errors object exists but is empty', async () => {
    // Given
    const errors = new AppErrors()
    const app = testAppLinked()
    app.errors = errors

    // When
    await validateApp(app, {json: true})

    // Then
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({valid: true, issues: []}, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderError).not.toHaveBeenCalled()
  })

  test('uses structured issues without a synthetic root issue when the rendered message is only bullet lines', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('tmp/shopify.app.toml', '• [client_id]: Required', [
      {
        filePath: 'tmp/shopify.app.toml',
        path: ['client_id'],
        pathString: 'client_id',
        message: 'Required',
        code: 'invalid_type',
      },
    ])
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
          ],
        },
        null,
        2,
      ),
    )
  })

  test('does not append a synthetic root issue for repeated same-file structured errors', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('tmp/shopify.app.toml', 'Validation errors in tmp/shopify.app.toml:\n\n• [client_id]: Required', [
      {
        filePath: 'tmp/shopify.app.toml',
        path: ['client_id'],
        pathString: 'client_id',
        message: 'Required',
        code: 'invalid_type',
      },
    ])
    errors.addError('tmp/shopify.app.toml', 'Validation errors in tmp/shopify.app.toml:\n\n• [name]: Must be set', [
      {
        filePath: 'tmp/shopify.app.toml',
        path: ['name'],
        pathString: 'name',
        message: 'Must be set',
        code: 'custom',
      },
    ])
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['name'],
              pathString: 'name',
              message: 'Must be set',
              code: 'custom',
            },
          ],
        },
        null,
        2,
      ),
    )
  })

  test('preserves a root issue when structured bullets are prefixed by meaningful context', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('tmp/shopify.app.toml', 'Could not infer extension handle\n\n• [client_id]: Required', [
      {
        filePath: 'tmp/shopify.app.toml',
        path: ['client_id'],
        pathString: 'client_id',
        message: 'Required',
        code: 'invalid_type',
      },
    ])
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: 'tmp/shopify.app.toml',
              path: [],
              pathString: 'root',
              message: 'Could not infer extension handle\n\n• [client_id]: Required',
            },
          ],
        },
        null,
        2,
      ),
    )
  })

  test('preserves a root issue when contextual text precedes a validation wrapper', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError(
      'tmp/shopify.app.toml',
      'Could not infer extension handle\n\nValidation errors in tmp/shopify.app.toml:\n\n• [client_id]: Required',
      [
        {
          filePath: 'tmp/shopify.app.toml',
          path: ['client_id'],
          pathString: 'client_id',
          message: 'Required',
          code: 'invalid_type',
        },
      ],
    )
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'tmp/shopify.app.toml',
              path: ['client_id'],
              pathString: 'client_id',
              message: 'Required',
              code: 'invalid_type',
            },
            {
              filePath: 'tmp/shopify.app.toml',
              path: [],
              pathString: 'root',
              message:
                'Could not infer extension handle\n\nValidation errors in tmp/shopify.app.toml:\n\n• [client_id]: Required',
            },
          ],
        },
        null,
        2,
      ),
    )
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
