import {validateApp} from './validate.js'
import {testAppLinked} from '../models/app/app.test-data.js'
import {AppErrors, formatConfigurationError} from '../models/app/loader.js'
import metadata from '../metadata.js'
import {describe, expect, test, vi} from 'vitest'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'

vi.mock('../metadata.js', () => ({default: {addPublicMetadata: vi.fn()}}))

async function expectLastValidationMetadata(expected: {
  cmd_app_validate_valid: boolean
  cmd_app_validate_issue_count: number
  cmd_app_validate_file_count: number
}) {
  const getMetadata = vi.mocked(metadata.addPublicMetadata).mock.calls.at(-1)?.[0]
  expect(getMetadata).toBeDefined()
  await expect(Promise.resolve(getMetadata!())).resolves.toEqual(expected)
}

describe('formatConfigurationError', () => {
  test('returns plain message when no path', () => {
    expect(formatConfigurationError({file: 'foo.toml', message: 'something broke'})).toBe('something broke')
  })

  test('includes field path when present', () => {
    expect(formatConfigurationError({file: 'foo.toml', path: ['access', 'admin'], message: 'Required'})).toBe(
      '[access.admin]: Required',
    )
  })

  test('adds a TOML table hint for object array type mismatches', () => {
    expect(
      formatConfigurationError({
        file: 'shopify.app.toml',
        path: ['events', '1', 'metrics'],
        message: 'Expected object, received array',
      }),
    ).toBe(
      '[events.1.metrics]: Expected object, received array. Use a TOML table instead of an array. [table] defines a single table; [[table]] defines an array of tables.',
    )
  })

  test('adds a TOML table hint to JSON Schema object array type mismatches', () => {
    const schemaParsed = jsonSchemaValidate(
      {events: [{metrics: []}]},
      {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                metrics: {type: 'object'},
              },
            },
          },
        },
      },
      'strip',
    )

    expect(schemaParsed.state).toBe('error')
    expect(schemaParsed.errors).toEqual([
      {
        path: ['events', '0', 'metrics'],
        message: 'Expected object, received array',
      },
    ])

    const schemaError = schemaParsed.errors?.[0]
    expect(schemaError).toBeDefined()
    expect(schemaError?.message).toBe('Expected object, received array')
    expect(
      formatConfigurationError({
        file: 'shopify.app.toml',
        path: schemaError!.path,
        message: schemaError!.message!,
      }),
    ).toBe(
      '[events.0.metrics]: Expected object, received array. Use a TOML table instead of an array. [table] defines a single table; [[table]] defines an array of tables.',
    )
  })

  test('does not add a TOML table hint for non-TOML files', () => {
    expect(
      formatConfigurationError({
        file: 'config.json',
        path: ['events', '1', 'metrics'],
        message: 'Expected object, received array',
      }),
    ).toBe('[events.1.metrics]: Expected object, received array')
  })

  test('does not add a TOML table hint for other type mismatches', () => {
    expect(
      formatConfigurationError({
        file: 'shopify.app.toml',
        path: ['events', '1', 'metrics'],
        message: 'Expected object, received string',
      }),
    ).toBe('[events.1.metrics]: Expected object, received string')
  })
})

describe('validateApp', () => {
  test('returns a valid result and records metadata when there are no errors', async () => {
    const app = testAppLinked()

    await expect(validateApp(app)).resolves.toEqual({valid: true, issues: []})

    await expectLastValidationMetadata({
      cmd_app_validate_valid: true,
      cmd_app_validate_issue_count: 0,
      cmd_app_validate_file_count: 0,
    })
  })

  test('returns a valid result when the errors object exists but is empty', async () => {
    const app = testAppLinked()
    app.errors = new AppErrors()

    await expect(validateApp(app)).resolves.toEqual({valid: true, issues: []})

    await expectLastValidationMetadata({
      cmd_app_validate_valid: true,
      cmd_app_validate_issue_count: 0,
      cmd_app_validate_file_count: 0,
    })
  })

  test('returns issues and records metadata when there are validation errors', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', message: 'client_id is required'})
    errors.addError({file: '/path/to/extensions/my-ext/shopify.extension.toml', message: 'invalid type "unknown"'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app)).resolves.toEqual({
      valid: false,
      issues: [
        {file: '/path/to/shopify.app.toml', message: 'client_id is required'},
        {file: '/path/to/extensions/my-ext/shopify.extension.toml', message: 'invalid type "unknown"'},
      ],
    })

    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 2,
      cmd_app_validate_file_count: 2,
    })
  })

  test('includes path and code in issues', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', path: ['name'], message: 'Required', code: 'invalid_type'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app)).resolves.toEqual({
      valid: false,
      issues: [{file: '/path/to/shopify.app.toml', message: 'Required', path: ['name'], code: 'invalid_type'}],
    })

    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 1,
      cmd_app_validate_file_count: 1,
    })
  })

  test('counts distinct files when multiple issues share a file', async () => {
    const errors = new AppErrors()
    errors.addError({file: '/path/to/shopify.app.toml', message: 'Missing required field'})
    errors.addError({file: '/path/to/shopify.app.toml', message: 'Invalid value'})
    const app = testAppLinked()
    app.errors = errors

    await expect(validateApp(app)).resolves.toMatchObject({valid: false})

    await expectLastValidationMetadata({
      cmd_app_validate_valid: false,
      cmd_app_validate_issue_count: 2,
      cmd_app_validate_file_count: 1,
    })
  })
})
