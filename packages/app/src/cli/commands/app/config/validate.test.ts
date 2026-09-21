import Validate from './validate.js'
import {appConfigValidateJsonOutputSchema} from '../../../services/validate/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {Project} from '../../../models/project/project.js'
import {selectActiveConfig} from '../../../models/project/active-config.js'
import {errorsForConfig} from '../../../models/project/config-selection.js'
import metadata from '../../../metadata.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')
vi.mock('../../../models/project/project.js')
vi.mock('../../../models/project/active-config.js')
vi.mock('../../../models/project/config-selection.js')
vi.mock('../../../metadata.js', () => ({default: {addPublicMetadata: vi.fn()}}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

async function expectValidationMetadataCalls(...expectedMetadata: Record<string, unknown>[]) {
  const metadataCalls = vi.mocked(metadata.addPublicMetadata).mock.calls.map(([getMetadata]) => getMetadata)
  expect(metadataCalls).toHaveLength(expectedMetadata.length)
  await expect(Promise.all(metadataCalls.map((getMetadata) => getMetadata()))).resolves.toEqual(expectedMetadata)
}

function mockHealthyProject() {
  vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
  vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
  vi.mocked(errorsForConfig).mockReturnValue([])
}

describe('app config validate command', () => {
  test('keeps --client-id mutually exclusive with --config', () => {
    expect(Validate.flags['client-id']?.exclusive).toEqual(['config'])
  })

  test('returns validation facts and presents text by default', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({valid: true, issues: []})

    await Validate.run([], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app)
    expect(renderSuccess).toHaveBeenCalledWith({headline: "App configuration 'shopify.app.toml' is valid."})
    expect(outputResult).not.toHaveBeenCalled()
    await expectValidationMetadataCalls({cmd_app_validate_json: false})
  })

  test('encodes validation facts when --json is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({valid: true, issues: []})

    await Validate.run(['--json'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app)
    expect(outputResult).toHaveBeenCalledWith(appConfigValidateJsonOutputSchema.encode({valid: true, issues: []}))
    expect(renderSuccess).not.toHaveBeenCalled()
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('outputs the encoded invalid payload and aborts when validation fails with --json', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    const issues = [{file: '/app/shopify.app.toml', message: 'Required', path: ['name'], code: 'invalid_type'}]
    vi.mocked(validateApp).mockResolvedValue({valid: false, issues})

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(appConfigValidateJsonOutputSchema.encode({valid: false, issues}))
    expect(renderError).not.toHaveBeenCalled()
  })

  test('renders validation errors and aborts when validation fails in text mode', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({
      valid: false,
      issues: [{file: '/app/shopify.app.toml', message: 'client_id is required'}],
    })

    await expect(Validate.run([], import.meta.url)).rejects.toThrow()

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Validation errors found.',
      body: expect.stringContaining('client_id is required'),
    })
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('accepts the -j alias', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({valid: true, issues: []})

    await Validate.run(['-j'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app)
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('skips active config prompts when --client-id is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(selectActiveConfig).mockResolvedValue({
      file: new TomlFile('shopify.app.staging.toml', {}),
    } as any)
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({valid: true, issues: []})

    await Validate.run(['--client-id', 'api-key'], import.meta.url)

    expect(selectActiveConfig).toHaveBeenCalledWith(expect.anything(), undefined, {
      clientId: 'api-key',
      skipPrompts: true,
    })
    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'api-key',
      forceRelink: false,
      userProvidedConfigName: 'shopify.app.staging.toml',
      unsafeTolerateErrors: true,
    })
    expect(validateApp).toHaveBeenCalledWith(app)
    await expectValidationMetadataCalls({cmd_app_validate_json: false})
  })

  test('keeps active config prompts enabled when --client-id is not passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({valid: true, issues: []})

    await Validate.run([], import.meta.url)

    expect(selectActiveConfig).toHaveBeenCalledWith(expect.anything(), undefined, {
      clientId: undefined,
      skipPrompts: false,
    })
    expect(validateApp).toHaveBeenCalledWith(app)
    await expectValidationMetadataCalls({cmd_app_validate_json: false})
  })

  test('outputs JSON issues when active config has TOML parse errors', async () => {
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
    vi.mocked(errorsForConfig).mockReturnValue([
      {path: '/app/shopify.app.toml', message: 'Unexpected character at row 1, col 5'} as any,
    ])

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"valid": false'))
    expect(linkedAppContext).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('records failure metadata for config errors in non-json mode', async () => {
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
    vi.mocked(errorsForConfig).mockReturnValue([
      {path: '/app/shopify.app.toml', message: 'Missing required field'} as any,
      {path: '/app/shopify.app.toml', message: 'Invalid value'} as any,
    ])

    await expect(Validate.run([], import.meta.url)).rejects.toThrow()

    expect(linkedAppContext).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: false},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 2,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('records failure metadata when Project.load fails with --json', async () => {
    vi.mocked(Project.load).mockRejectedValue(new AbortError('Could not find app configuration'))

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"valid": false'))
    expect(selectActiveConfig).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('records failure metadata when selectActiveConfig fails with --json', async () => {
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockRejectedValue(new AbortError('No config found'))

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"valid": false'))
    expect(linkedAppContext).not.toHaveBeenCalled()
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })

  test('records failure metadata when linkedAppContext throws a validation error with --json', async () => {
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
    vi.mocked(errorsForConfig).mockReturnValue([])
    vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Validation errors in /app/shopify.app.toml'))

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"valid": false'))
    await expectValidationMetadataCalls(
      {cmd_app_validate_json: true},
      {
        cmd_app_validate_valid: false,
        cmd_app_validate_issue_count: 1,
        cmd_app_validate_file_count: 1,
      },
    )
  })
})

test('exposes the validation schema and JSON flag', () => {
  expect(Validate.jsonOutputSchema).toBe(appConfigValidateJsonOutputSchema)
  expect(Validate.flags.json).toBeDefined()
  expect(Validate.description).toContain('AppConfigValidateResult')
})

test('does not convert authentication failures into validation results', async () => {
  mockHealthyProject()
  vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Authentication failed'))
  await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()
  expect(outputResult).not.toHaveBeenCalled()
  await expectValidationMetadataCalls({cmd_app_validate_json: true})
})
