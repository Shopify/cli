import {buildFunctionExtension} from './extension.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {buildGraphqlTypes, buildJSFunction, runWasmOpt, runTrampoline} from '../function/build.js'
import {validateSchemaApiVersion} from '../function/schema-version.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import lockfile from 'proper-lockfile'
import {AbortError} from '@shopify/cli-kit/node/error'
import * as fs from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('../function/build.js')
vi.mock('../function/schema-version.js')
vi.mock('proper-lockfile')

describe('buildFunctionExtension', () => {
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

  const setup = async (tmpDir: string, config: any = defaultConfig, entryPath?: string) => {
    const releaseLock = vi.fn()
    const stdout = {write: vi.fn()} as unknown as Writable
    const stderr = {write: vi.fn()} as unknown as Writable
    const signal = vi.fn() as any
    const app = {} as any
    const extension = await testFunctionExtension({
      config,
      dir: tmpDir,
      entryPath,
    })
    vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
    return {extension, stdout, stderr, signal, app, releaseLock}
  }

  test('delegates the build to system when the build command is present', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir)
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
  })

  test('fails when is not a JS function and build command is not present', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir)
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
  })

  test('succeeds when is a JS function and build command is not present', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir, defaultConfig, 'src/index.js')
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
  })

  test('succeeds when is a JS function and build command is present', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir, defaultConfig, 'src/index.js')
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
  })

  test('performs wasm-opt execution by default', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir)
      await fs.mkdir(joinPath(tmpDir, 'dist'))
      await fs.touchFile(joinPath(tmpDir, 'dist/index.wasm'))

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
  })

  test('performs trampoline execution by default', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir)
      await fs.mkdir(joinPath(tmpDir, 'dist'))
      await fs.touchFile(joinPath(tmpDir, 'dist/index.wasm'))

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
  })

  test('skips wasm-opt execution when the disable-wasm-opt is true', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir)
      await fs.mkdir(joinPath(tmpDir, 'dist'))
      await fs.touchFile(joinPath(tmpDir, 'dist/index.wasm'))
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
  })

  test('fails when build lock cannot be acquired', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir)
      vi.mocked(lockfile.lock).mockRejectedValue(new Error('failed to acquire lock'))

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

  test('handles function with undefined build config', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configWithoutBuild = {
        name: 'MyFunction',
        type: 'product_discounts',
        description: '',
        configuration_ui: true,
        api_version: '2022-07',
        metafields: [],
      } as unknown as FunctionConfigType

      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(
        tmpDir,
        configWithoutBuild,
        'src/index.js',
      )
      await fs.touchFile(extension.outputPath)

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
  })

  test('runs typegen_command before build for non-JS function', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
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
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir, configWithTypegen)

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
  })

  test('runs typegen_command before build for JS function with custom build command', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
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
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir, configWithTypegen, 'src/index.js')

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
  })

  test('does not run typegen when typegen_command is not set', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
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
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir, configWithoutTypegen)

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
  })

  test('handles function with build config but undefined path', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
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

      const {extension, stdout, stderr, signal, app, releaseLock} = await setup(tmpDir, configWithoutPath)
      await fs.touchFile(extension.outputPath)

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
  })

  test('calls validateSchemaApiVersion with the values from the extension config', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir)

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
      expect(validateSchemaApiVersion).toHaveBeenCalledWith({
        directory: extension.directory,
        localIdentifier: extension.localIdentifier,
        apiVersion: extension.configuration.api_version,
      })
    })
  })

  test('does not rebundle when build.path stays in the default output directory', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {extension, stdout, stderr, signal, app} = await setup(tmpDir)
      extension.configuration.build!.path = 'dist/custom.wasm'
      const customPath = joinPath(extension.directory, 'dist/custom.wasm')
      await fs.mkdir(dirname(customPath))
      await fs.touchFile(customPath)

      const touchFileSpy = vi.spyOn(fs, 'touchFile')
      const writeFileSpy = vi.spyOn(fs, 'writeFile')

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
      expect(fs.fileExistsSync(customPath)).toBe(true)
      expect(touchFileSpy).not.toHaveBeenCalled()
      expect(writeFileSpy).not.toHaveBeenCalled()
    })
  })
})
