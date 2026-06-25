import {buildFunctionExtension} from './extension.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {buildGraphqlTypes, buildJSFunction, runWasmOpt, runTrampoline} from '../function/build.js'
import {validateSchemaApiVersion} from '../function/schema-version.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import lockfile from 'proper-lockfile'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, touchFile, writeFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('../function/build.js')
vi.mock('../function/schema-version.js')
vi.mock('proper-lockfile')

describe('buildFunctionExtension', () => {
  const stdout = {write: vi.fn()}
  const stderr = {write: vi.fn()}
  const signal = vi.fn()
  const app = {}
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

  test('delegates the build to system when the build command is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      extension.configuration.build!.command = './scripts/build.sh argument'
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      extension.configuration.build!.command = undefined
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // Then
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).rejects.toThrow()
      expect(releaseLock).toHaveBeenCalled()
    })
  })

  test('succeeds when is a JS function and build command is not present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
        entryPath: 'src/index.js',
      })
      extension.configuration.build!.command = undefined
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
        entryPath: 'src/index.js',
      })
      extension.configuration.build!.command = './scripts/build.sh argument'
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await mkdir(joinPath(tmpDir, 'dist'))
      await touchFile(joinPath(tmpDir, 'dist/index.wasm'))

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).resolves.toBeUndefined()

      // Then
      expect(runWasmOpt).toHaveBeenCalled()
    })
  })

  test('performs trampoline execution by default', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await mkdir(joinPath(tmpDir, 'dist'))
      await touchFile(joinPath(tmpDir, 'dist/index.wasm'))

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).resolves.toBeUndefined()

      // Then
      expect(runTrampoline).toHaveBeenCalled()
    })
  })

  test('skips wasm-opt execution when the disable-wasm-opt is true', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await mkdir(joinPath(tmpDir, 'dist'))
      await touchFile(joinPath(tmpDir, 'dist/index.wasm'))
      extension.configuration.build!.wasm_opt = false

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).resolves.toBeUndefined()

      // Then
      expect(runWasmOpt).not.toHaveBeenCalled()
    })
  })

  test('fails when build lock cannot be acquired', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      vi.mocked(lockfile.lock).mockRejectedValue(new Error('failed to acquire lock'))

      // Then
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).rejects.toThrow(AbortError)
    })
  })

  test('handles function with undefined build config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configWithoutBuild = {
        name: 'MyFunction',
        type: 'product_discounts',
        description: '',
        configuration_ui: true,
        api_version: '2022-07',
        metafields: [],
      } as unknown as FunctionConfigType

      const extension = await testFunctionExtension({
        config: configWithoutBuild,
        dir: tmpDir,
        entryPath: 'src/index.js',
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await touchFile(extension.outputPath)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
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
      const extension = await testFunctionExtension({
        config: configWithTypegen,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
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
      const extension = await testFunctionExtension({
        config: configWithTypegen,
        dir: tmpDir,
        entryPath: 'src/index.js',
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
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
      const extension = await testFunctionExtension({
        config: configWithoutTypegen,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).resolves.toBeUndefined()

      // Then
      expect(buildGraphqlTypes).not.toHaveBeenCalled()
    })
  })

  test('handles function with build config but undefined path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
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

      const extension = await testFunctionExtension({
        config: configWithoutPath,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await mkdir(joinPath(tmpDir, 'dist'))
      await touchFile(joinPath(tmpDir, 'dist/index.wasm'))

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: tmpDir,
      })
      extension.configuration.build!.path = 'dist/custom.wasm'
      const releaseLock = vi.fn()
      vi.mocked(lockfile.lock).mockResolvedValue(releaseLock)
      await mkdir(joinPath(tmpDir, 'dist'))
      const customWasmPath = joinPath(tmpDir, 'dist/custom.wasm')
      await touchFile(customWasmPath)

      const bundlePath = extension.outputPath

      // When
      await expect(
        buildFunctionExtension(extension, {
          stdout,
          stderr,
          signal,
          app: app as any,
          environment: 'production',
        }),
      ).resolves.toBeUndefined()

      // Then
      expect(fileExistsSync(bundlePath)).toBe(false)
    })
  })
})
