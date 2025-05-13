import {buildFunctionExtension} from './extension.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {buildJSFunction, runWasmOpt, runTrampoline} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import lockfile from 'proper-lockfile'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('../function/build.js')
vi.mock('proper-lockfile')
vi.mock('@shopify/cli-kit/node/fs')

describe('buildFunctionExtension', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let stdout: any
  let stderr: any
  let signal: any
  let app: any
  let releaseLock: any
  const defaultConfig = {
    name: 'MyFunction',
    type: 'product_discounts',
    description: '',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
      wasm_opt: true,
    },
    configuration_ui: true,
    api_version: '2022-07',
    metafields: [],
  }

  beforeEach(async () => {
    releaseLock = vi.fn()
    stdout = vi.fn()
    stderr = {write: vi.fn()}
    stdout = {write: vi.fn()}
    signal = vi.fn()
    app = {}
    extension = await testFunctionExtension({config: defaultConfig})
    vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
  })

  test('delegates the build to system when the build command is present', async () => {
    // Given
    extension.configuration.build.command = './scripts/build.sh argument'

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(exec).toHaveBeenCalledWith('./scripts/build.sh', ['argument'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
    expect(releaseLock).toHaveBeenCalled()
  })

  test('fails when is not a JS function and build command is not present', async () => {
    // Given
    extension.configuration.build.command = undefined

    // Then
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).rejects.toThrow()
    expect(releaseLock).toHaveBeenCalled()
  })

  test('succeeds when is a JS function and build command is not present', async () => {
    // Given
    extension = await testFunctionExtension({config: defaultConfig, entryPath: 'src/index.js'})
    extension.configuration.build.command = undefined

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(buildJSFunction).toHaveBeenCalledWith(extension, {
      stdout,
      stderr,
      signal,
      app,
      environment: 'production',
    })
    expect(releaseLock).toHaveBeenCalled()
  })

  test('succeeds when is a JS function and build command is present', async () => {
    // Given
    extension = await testFunctionExtension({config: defaultConfig, entryPath: 'src/index.js'})
    extension.configuration.build.command = './scripts/build.sh argument'

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(exec).toHaveBeenCalledWith('./scripts/build.sh', ['argument'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
    expect(releaseLock).toHaveBeenCalled()
  })

  test('performs wasm-opt execution by default', async () => {
    // Given
    vi.mocked(fileExistsSync).mockResolvedValue(true)

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(runWasmOpt).toHaveBeenCalled()
  })

  test('performs trampoline execution by default', async () => {
    // Given
    vi.mocked(fileExistsSync).mockResolvedValue(true)

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(runTrampoline).toHaveBeenCalled()
  })

  test('skips wasm-opt execution when the disable-wasm-opt is true', async () => {
    // Given
    vi.mocked(fileExistsSync).mockResolvedValue(true)
    extension.configuration.build.wasm_opt = false

    // When
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).resolves.toBeUndefined()

    // Then
    expect(runWasmOpt).not.toHaveBeenCalled()
  })

  test('fails when build lock cannot be acquired', async () => {
    // Given
    vi.mocked(lockfile.lock).mockRejectedValue('failed to acquire lock')

    // Then
    await expect(
      buildFunctionExtension(extension, {
        stdout,
        stderr,
        signal,
        app,
        environment: 'production',
      }),
    ).rejects.toThrow(AbortError)
    expect(releaseLock).not.toHaveBeenCalled()
  })
})
