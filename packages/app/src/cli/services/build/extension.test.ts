import {buildFunctionExtension} from './extension.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')

describe('buildFunctionExtension', () => {
  let extension: FunctionExtension
  let stdout: any
  let stderr: any
  let signal: any
  let app: any

  beforeEach(async () => {
    stdout = vi.fn()
    stderr = {write: vi.fn()}
    stdout = {write: vi.fn()}
    signal = vi.fn()
    app = {}
    extension = await testFunctionExtension({
      name: 'MyFunction',
      type: 'product_discounts',
      description: '',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
      },
      configurationUi: true,
      apiVersion: '2022-07',
    })
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
