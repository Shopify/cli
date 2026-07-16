import Validate from './validate.js'
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
  test('calls validateApp with json: false by default', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run([], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: false})
    await expectValidationMetadataCalls({cmd_app_validate_json: false})
  })

  test('calls validateApp with json: true when --json flag is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run(['--json'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
  })

  test('calls validateApp with json: true when -j flag is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run(['-j'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
    await expectValidationMetadataCalls({cmd_app_validate_json: true})
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
