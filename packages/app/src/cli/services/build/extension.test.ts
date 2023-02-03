import {buildFunctionExtension} from './extension.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')

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
        build: {
          command: 'make build',
        },
        configurationUi: true,
        apiVersion: '2022-07',
      },
      buildWasmPath: () => '/test/myfunction/dist/index.wasm',
      inputQueryPath: () => '/test/myfunction/input.graphql',
      publishURL: () => Promise.resolve(''),
      graphQLType: 'product_discounts',
      directory: '/test/myfunction',
      configurationPath: '/test/myfunction/shopify.function.extension.toml',
      idEnvironmentVariableName: 'MY_FUNCTION_ID',
      localIdentifier: 'myfunction',
      externalType: 'product_discounts',
      type: 'product_discounts',
    }
  })

  test('delegates the build to system when the build command is present', async () => {
    // Given
    extension.configuration.build = {
      command: './scripts/build.sh argument',
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

    expect(exec).toHaveBeenCalledWith('./scripts/build.sh', ['argument'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
  })
})
