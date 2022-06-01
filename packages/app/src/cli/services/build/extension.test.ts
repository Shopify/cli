import {buildFunctionExtension} from './extension'
import {FunctionExtension} from '../../models/app/app'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {system, error} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      system: {
        exec: vi.fn(),
      },
    }
  })
})

describe('buildFunctionExtension', () => {
  let extension: FunctionExtension
  let stdout: any
  let stderr: any
  let signal: any
  let app: any

  beforeEach(() => {
    stdout = vi.fn()
    stderr = {write: vi.fn()}
    stdout = {write: vi.fn()}
    signal = vi.fn()
    app = {}
    extension = {
      configuration: {
        name: 'MyFunction',
        type: 'product_discounts',
        description: '',
        commands: {},
        configurationUi: true,
        version: '2',
      },
      metadata: {
        schemaVersions: {},
      },
      buildWasmPath: '/test/myfunction/dist/index.wasm',
      graphQLType: 'product_discounts',
      directory: '/test/myfunction',
      configurationPath: '/test/myfunction/shopify.function.extension.toml',
      idEnvironmentVariableName: 'MY_FUNCTION_ID',
      localIdentifier: 'myfunction',
      type: 'product_discounts',
    }
  })
  test('throws a MissingBuildCommandError when the build command is missing', async () => {
    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
      }),
    ).rejects.toEqual(new error.AbortSilent())
    expect(system.exec).not.toHaveBeenCalled()
  })

  test('throws a MissingBuildCommandError when the build command is empty', async () => {
    // Given
    extension.configuration.commands = {
      build: '   ',
    }

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
      }),
    ).rejects.toEqual(new error.AbortSilent())
    expect(system.exec).not.toHaveBeenCalled()
  })

  test('delegates the build to system when the build command is present', async () => {
    // Given
    extension.configuration.commands = {
      build: './scripts/build.sh argument',
    }

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
      }),
    ).resolves.toBeUndefined()

    expect(system.exec).toHaveBeenCalledWith('./scripts/build.sh', ['argument'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
  })
})
