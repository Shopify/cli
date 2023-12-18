import {buildFunctionExtension} from './extension.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {buildJSFunction} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('../function/build.js')

describe('buildFunctionExtension', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let stdout: any
  let stderr: any
  let signal: any
  let app: any
  const defaultConfig = {
    name: 'MyFunction',
    type: 'product_discounts',
    description: '',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configuration_ui: true,
    api_version: '2022-07',
    metafields: [],
  }

  beforeEach(async () => {
    stdout = vi.fn()
    stderr = {write: vi.fn()}
    stdout = {write: vi.fn()}
    signal = vi.fn()
    app = {}
    extension = await testFunctionExtension({config: defaultConfig})
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
  })
})
