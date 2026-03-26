import {validateApp} from './validate.js'
import {testAppLinked} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {AppErrors} from '../models/app/loader.js'
import {describe, expect, test, vi} from 'vitest'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('../metadata.js', () => ({default: {addPublicMetadata: vi.fn()}}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/ui')

async function expectLastValidationMetadata(expected: {
  cmd_app_validate_valid: boolean
  cmd_app_validate_issue_count: number
  cmd_app_validate_file_count: number
}) {
  const getMetadata = vi.mocked(metadata.addPublicMetadata).mock.calls.at(-1)?.[0]
  expect(getMetadata).toBeDefined()
  await expect(Promise.resolve(getMetadata!())).resolves.toEqual(expected)
}

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
    await expectLastValidationMetadata({
      cmd_app_validate_valid: true,
      cmd_app_validate_issue_count: 0,
      cmd_app_validate_file_count: 0,
    })
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
    await expectLastValidationMetadata({
      cmd_app_validate_valid: true,
      cmd_app_validate_issue_count: 0,
      cmd_app_validate_file_count: 0,
    })
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
    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 2,
      cmd_app_validate_file_count: 2,
    })
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
          issues: [
            {
              filePath: '/path/to/shopify.app.toml',
              path: [],
              pathString: 'root',
              message: 'client_id is required',
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
    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 2,
      cmd_app_validate_file_count: 2,
    })
  })

  test('outputs only structured issues when the rendered message matches them exactly', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('/path/to/shopify.app.toml', '• [client_id]: Required', [
      {
        filePath: '/path/to/shopify.app.toml',
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
              filePath: '/path/to/shopify.app.toml',
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

  test('outputs only structured issues when the rendered message is a validation wrapper around them', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError(
      '/path/to/shopify.app.toml',
      'Validation errors in /path/to/shopify.app.toml:\n\n• [client_id]: Required',
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
          ],
        },
        null,
        2,
      ),
    )
  })

  test('adds a root issue when the rendered message includes extra context beyond the structured issues', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError(
      '/path/to/shopify.app.toml',
      'Validation errors in /path/to/shopify.app.toml:\n\n• [client_id]: Required\n\nFix the app config before continuing.',
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
              path: [],
              pathString: 'root',
              message:
                'Validation errors in /path/to/shopify.app.toml:\n\n• [client_id]: Required\n\nFix the app config before continuing.',
            },
          ],
        },
        null,
        2,
      ),
    )
    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 1,
      cmd_app_validate_file_count: 1,
    })
  })

  test('counts a distinct root issue when the rendered message changes to a new same-file error', async () => {
    // Given
    const errors = new AppErrors()
    errors.addError('/path/to/shopify.app.toml', '• [client_id]: Required', [
      {
        filePath: '/path/to/shopify.app.toml',
        path: ['client_id'],
        pathString: 'client_id',
        message: 'Required',
        code: 'invalid_type',
      },
    ])
    errors.addError('/path/to/shopify.app.toml', 'Unsupported section(s) in app configuration: webhooks')
    const app = testAppLinked()
    app.errors = errors

    // When / Then
    await expect(validateApp(app, {json: true})).rejects.toThrow(AbortSilentError)
    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 2,
      cmd_app_validate_file_count: 1,
    })
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
