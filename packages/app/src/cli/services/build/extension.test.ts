import {buildFunctionExtension} from './extension.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {buildGraphqlTypes, buildJSFunction, runWasmOpt, runTrampoline} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import lockfile from 'proper-lockfile'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import * as outputModule from '@shopify/cli-kit/node/output'
import {open} from 'fs/promises'

vi.mock('fs/promises', async () => {
  const actual: any = await vi.importActual('fs/promises')
  return {...actual, open: vi.fn(actual.open)}
})

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
    extension.configuration.build!.command = './scripts/build.sh argument'

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
    extension.configuration.build!.command = undefined

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
    extension.configuration.build!.command = undefined

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
    extension.configuration.build!.command = './scripts/build.sh argument'

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
    extension.configuration.build!.wasm_opt = false

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

  test('handles function with undefined build config', async () => {
    // Given
    const configWithoutBuild = {
      name: 'MyFunction',
      type: 'product_discounts',
      description: '',
      configuration_ui: true,
      api_version: '2022-07',
      metafields: [],
    } as unknown as FunctionConfigType

    extension = await testFunctionExtension({config: configWithoutBuild, entryPath: 'src/index.js'})
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
    expect(buildJSFunction).toHaveBeenCalledWith(extension, {
      stdout,
      stderr,
      signal,
      app,
      environment: 'production',
    })
    expect(releaseLock).toHaveBeenCalled()
    // wasm_opt should not be called when build config is undefined
    expect(runWasmOpt).not.toHaveBeenCalled()
  })

  test('runs typegen_command before build for non-JS function', async () => {
    // Given
    const configWithTypegen = {
      name: 'MyFunction',
      type: 'product_discounts',
      description: '',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
        wasm_opt: true,
        typegen_command: 'npx shopify-function-codegen --schema schema.graphql',
      },
      configuration_ui: true,
      api_version: '2022-07',
      metafields: [],
    }
    extension = await testFunctionExtension({config: configWithTypegen})

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
    expect(buildGraphqlTypes).toHaveBeenCalledWith(extension, {
      stdout,
      stderr,
      signal,
      app,
      environment: 'production',
    })
    expect(exec).toHaveBeenCalledWith('make', ['build'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
  })

  test('runs typegen_command before build for JS function with custom build command', async () => {
    // Given
    const configWithTypegen = {
      name: 'MyFunction',
      type: 'product_discounts',
      description: '',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
        wasm_opt: true,
        typegen_command: 'custom-typegen --output types.ts',
      },
      configuration_ui: true,
      api_version: '2022-07',
      metafields: [],
    }
    extension = await testFunctionExtension({config: configWithTypegen, entryPath: 'src/index.js'})

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
    expect(buildGraphqlTypes).toHaveBeenCalledWith(extension, {
      stdout,
      stderr,
      signal,
      app,
      environment: 'production',
    })
    expect(exec).toHaveBeenCalledWith('make', ['build'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
  })

  test('does not run typegen when typegen_command is not set', async () => {
    // Given
    const configWithoutTypegen = {
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
    extension = await testFunctionExtension({config: configWithoutTypegen})

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
    expect(buildGraphqlTypes).not.toHaveBeenCalled()
  })

  test('handles function with build config but undefined path', async () => {
    // Given
    const configWithoutPath = {
      name: 'MyFunction',
      type: 'product_discounts',
      description: '',
      build: {
        command: 'make build',
        wasm_opt: true,
        // path is undefined
      },
      configuration_ui: true,
      api_version: '2022-07',
      metafields: [],
    } as unknown as FunctionConfigType

    extension = await testFunctionExtension({config: configWithoutPath})
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
    expect(exec).toHaveBeenCalledWith('make', ['build'], {
      stdout,
      stderr,
      cwd: extension.directory,
      signal,
    })
    expect(releaseLock).toHaveBeenCalled()
    expect(runWasmOpt).toHaveBeenCalled()
  })

  describe('schema version mismatch warning', () => {
    function mockSchemaFile(content: string) {
      const buf = Buffer.from(content)
      const handle = {
        read: vi.fn().mockImplementation(async (target: Buffer, _offset: number, length: number) => {
          const bytesRead = Math.min(buf.length, length)
          buf.copy(target, 0, 0, bytesRead)
          return {bytesRead, buffer: target}
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }
      vi.mocked(open).mockResolvedValue(handle as any)
      return handle
    }

    function mockSchemaNotFound() {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(open).mockRejectedValue(err)
    }

    test('warns when schema version does not match toml version', async () => {
      const warnSpy = vi.spyOn(outputModule, 'outputWarn').mockImplementation(() => {})
      mockSchemaFile('schema @apiVersion(version: "2025-01") {\n  query: QueryRoot\n}')

      await buildFunctionExtension(extension, {stdout, stderr, signal, app, environment: 'production'})

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('schema.graphql was generated for API version 2025-01 but your extension targets 2022-07'),
      )
    })

    test('does not warn when schema version matches toml version', async () => {
      const warnSpy = vi.spyOn(outputModule, 'outputWarn').mockImplementation(() => {})
      mockSchemaFile('schema @apiVersion(version: "2022-07") {\n  query: QueryRoot\n}')

      await buildFunctionExtension(extension, {stdout, stderr, signal, app, environment: 'production'})

      expect(warnSpy).not.toHaveBeenCalled()
    })

    test('does not warn when schema has no apiVersion directive', async () => {
      const warnSpy = vi.spyOn(outputModule, 'outputWarn').mockImplementation(() => {})
      mockSchemaFile('type Query { shop: Shop }')

      await buildFunctionExtension(extension, {stdout, stderr, signal, app, environment: 'production'})

      expect(warnSpy).not.toHaveBeenCalled()
    })

    test('does not warn when schema file does not exist', async () => {
      const warnSpy = vi.spyOn(outputModule, 'outputWarn').mockImplementation(() => {})
      mockSchemaNotFound()

      await buildFunctionExtension(extension, {stdout, stderr, signal, app, environment: 'production'})

      expect(warnSpy).not.toHaveBeenCalled()
    })
  })
})
