import Validate from './validate.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import metadata from '../../../metadata.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {LocalConfigError} from '../../../models/app/local-config-error.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')
vi.mock('../../../metadata.js', () => ({default: {addPublicMetadata: vi.fn()}}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

async function expectValidationMetadataCalls(...expectedMetadata: Record<string, unknown>[]) {
  const metadataCalls = vi.mocked(metadata.addPublicMetadata).mock.calls.map(([getMetadata]) => getMetadata)
  expect(metadataCalls).toHaveLength(expectedMetadata.length)

  await expect(Promise.all(metadataCalls.map((getMetadata) => getMetadata()))).resolves.toEqual(expectedMetadata)
}

describe('app config validate command', () => {
  test('calls validateApp with json: false by default', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run([], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: false})
    await expectValidationMetadataCalls({cmd_app_validate_json: false})
  })

  test('calls validateApp with json: true when --json flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['--json'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('calls validateApp with json: true when -j flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['-j'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('rethrows LocalConfigError in non-json mode without emitting json', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new LocalConfigError('Validation errors in /tmp/shopify.app.toml', '/tmp/shopify.app.toml'),
    )

    // When / Then
    await expect(Validate.run(['--path=/tmp/app'], import.meta.url)).rejects.toThrow()
    expect(outputResult).not.toHaveBeenCalled()
    expect(validateApp).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: false},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('outputs structured configuration issues from app loading before validateApp runs', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new LocalConfigError(
        'Validation errors in /tmp/shopify.app.toml:\n\n• [name]: String is required',
        '/tmp/shopify.app.toml',
        [
          {
            filePath: '/tmp/shopify.app.toml',
            path: ['name'],
            pathString: 'name',
            message: 'String is required',
          },
        ],
      ),
    )

    // When / Then
    await expect(Validate.run(['--json', '--path=/tmp/app'], import.meta.url)).rejects.toThrow(
      'process.exit unexpectedly called with "1"',
    )
    expect(outputResult).toHaveBeenCalledTimes(1)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/shopify.app.toml',
              path: ['name'],
              pathString: 'name',
              message: 'String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('outputs a root json issue when app loading fails without structured issues', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new LocalConfigError("Couldn't find an app toml file at /tmp/app", '/tmp/app'),
    )

    // When / Then
    await expect(Validate.run(['--json', '--path=/tmp/app'], import.meta.url)).rejects.toThrow(
      'process.exit unexpectedly called with "1"',
    )
    expect(outputResult).toHaveBeenCalledTimes(1)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/app',
              path: [],
              pathString: 'root',
              message: "Couldn't find an app toml file at /tmp/app",
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('outputs json when validateApp throws a structured configuration abort', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockRejectedValue(
      new LocalConfigError(
        'Validation errors in /tmp/shopify.app.toml:\n\n• [name]: String is required',
        '/tmp/shopify.app.toml',
        [
          {
            filePath: '/tmp/shopify.app.toml',
            path: ['name'],
            pathString: 'name',
            message: 'String is required',
          },
        ],
      ),
    )

    // When / Then
    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow('process.exit unexpectedly called with "1"')
    expect(outputResult).toHaveBeenCalledTimes(1)
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/shopify.app.toml',
              path: ['name'],
              pathString: 'name',
              message: 'String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('rethrows non-configuration errors from validateApp in json mode without converting them to validation json', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockRejectedValue(new AbortError('network problem'))

    // When / Then
    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()
    expect(outputResult).not.toHaveBeenCalled()
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('rethrows unrelated abort errors in json mode without converting them to validation json', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Could not find store for domain shop.example.com'))

    // When / Then
    await expect(Validate.run(['--json', '--path=/tmp/app'], import.meta.url)).rejects.toThrow()
    expect(outputResult).not.toHaveBeenCalled()
    expect(validateApp).not.toHaveBeenCalled()
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })
})
