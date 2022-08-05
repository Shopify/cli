import {uploadFunctionExtensions} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {path, file, api, http} from '@shopify/cli-kit'

function mockFunctionCompilation(jobId = 'job-id'): void {
  const status = 'completed'

  const compileModuleResponse: api.graphql.CompileModuleMutationSchema = {
    data: {
      compileModule: {
        jobId,
        userErrors: [],
      },
    },
  }
  const moduleCompilationStatusResponse: api.graphql.ModuleCompilationStatusQuerySchema = {
    data: {
      moduleCompilationStatus: {
        status,
        userErrors: [],
      },
    },
  }

  vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(compileModuleResponse)
  vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(moduleCompilationStatusResponse)
}

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      api: {
        ...cliKit.api,
        partners: {
          functionProxyRequest: vi.fn(),
        },
      },
      http: {
        fetch: vi.fn(),
      },
    }
  })
})

describe('uploadFunctionExtensions', () => {
  let extension: FunctionExtension
  let identifiers: Identifiers
  let token: string

  beforeEach(() => {
    extension = {
      directory: '/function',
      configuration: {
        name: 'function',
        type: 'payment_methods',
        description: 'my function',
        build: {
          command: 'make build',
          path: 'dist/index.wasm',
        },
        ui: {
          paths: {
            create: '/create',
            details: '/details/:id',
          },
        },
        configurationUi: false,
        apiVersion: '2022-07',
      },
      configurationPath: '/function/shopify.function.extension.toml',
      buildWasmPath: () => '/function/dist/index.wasm',
      inputQueryPath: () => '/function/input.graphql',
      idEnvironmentVariableName: 'SHOPIFY_FUNCTION_ID',
      localIdentifier: 'my-function',
      metadata: {schemaVersions: {payment_methods: {major: 1, minor: 0}}},
      type: 'payment_methods',
      graphQLType: 'payment_methods',
    }
    token = 'token'
    identifiers = {
      app: 'api=key',
      extensions: {},
      extensionIds: {},
    }
  })

  test('throws an error if the request to return the url errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLError = new Error('upload error')
      vi.mocked(api.partners.functionProxyRequest).mockRejectedValueOnce(uploadURLError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadURLError)

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the upload of the wasm errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const uploadError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation(compilationJobId)
      vi.mocked(http.fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the compilation request errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const uploadError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the compilation fails', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const compileModuleResponse: api.graphql.CompileModuleMutationSchema = {
        data: {
          compileModule: {
            jobId: 'job-id',
            userErrors: [],
          },
        },
      }
      const moduleCompilationStatusResponse: api.graphql.ModuleCompilationStatusQuerySchema = {
        data: {
          moduleCompilationStatus: {
            status: 'failed',
            userErrors: [],
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(compileModuleResponse)
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(moduleCompilationStatusResponse)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        /Function my-function compilation failed./,
      )
    })
  })

  test('errors if the compilation times out', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const compileModuleResponse: api.graphql.CompileModuleMutationSchema = {
        data: {
          compileModule: {
            jobId: 'job-id',
            userErrors: [],
          },
        },
      }
      const moduleCompilationStatusResponse: api.graphql.ModuleCompilationStatusQuerySchema = {
        data: {
          moduleCompilationStatus: {
            status: 'pending',
            userErrors: [],
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(compileModuleResponse)
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValue(moduleCompilationStatusResponse)

      // When
      const promise = () => uploadFunctionExtensions([extension], {token, identifiers})

      vi.runAllTimers()

      // Then
      expect(promise).rejects.toThrowError(/Function my-function compilation timed out./)
    })
  })

  test('errors if the update of the function errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      const createdUUID = 'uuid'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const updateAppFunctionError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockRejectedValueOnce(updateAppFunctionError)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        updateAppFunctionError,
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
      expect(http.fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),

        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        4,
        identifiers.app,
        api.graphql.AppFunctionSetMutation,
        token,
        {
          uuid: undefined,
          extensionPointName: 'PAYMENT_METHODS',
          title: extension.configuration.name,
          description: extension.configuration.description,
          force: true,
          schemaMajorVersion: '1',
          schemaMinorVersion: '0',
          configurationUi: extension.configuration.configurationUi,
          moduleUploadUrl: uploadUrl,
          apiVersion: extension.configuration.apiVersion,
          skipCompilationJob: true,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })

  test('throws if the response from updating the app function contains errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      const createdUUID = 'uuid'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          appScriptSet: {
            userErrors: [
              {
                field: 'field',
                message: 'missing field',
                tag: 'tag',
              },
            ],
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        /The deployment of functions failed with the following errors:/,
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
      expect(http.fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),

        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        4,
        identifiers.app,
        api.graphql.AppFunctionSetMutation,
        token,
        {
          uuid: undefined,
          extensionPointName: 'PAYMENT_METHODS',
          title: extension.configuration.name,
          description: extension.configuration.description,
          force: true,
          schemaMajorVersion: '1',
          schemaMinorVersion: '0',
          configurationUi: extension.configuration.configurationUi,
          moduleUploadUrl: uploadUrl,
          apiVersion: extension.configuration.apiVersion,
          skipCompilationJob: true,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })

  test('creates and uploads the function', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'url'
      const createdUUID = 'uuid'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          appScriptSet: {
            userErrors: [],
            appScript: {
              uuid: createdUUID,
              appKey: identifiers.app,
              configSchema: {},
              title: extension.configuration.name,
              extensionPointName: 'PAYMENT_METHODS',
            },
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(createdUUID)
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.ModuleUploadUrlGenerateMutation,
        token,
      )
      expect(http.fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),

        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        4,
        identifiers.app,
        api.graphql.AppFunctionSetMutation,
        token,
        {
          uuid: undefined,
          extensionPointName: 'PAYMENT_METHODS',
          title: extension.configuration.name,
          description: extension.configuration.description,
          force: true,
          schemaMajorVersion: '1',
          schemaMinorVersion: '0',
          configurationUi: extension.configuration.configurationUi,
          moduleUploadUrl: uploadUrl,
          apiVersion: extension.configuration.apiVersion,
          skipCompilationJob: true,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })

  test('appBridge is set to undefined when there is no configuration.ui.paths', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui = undefined

      const uploadUrl = 'url'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.ModuleUploadUrlGenerateMutationSchema = {
        data: {
          moduleUploadUrlGenerate: {
            details: {
              headers: {},
              humanizedMaxSize: '200',
              url: uploadUrl,
            },
            userErrors: [],
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          appScriptSet: {
            userErrors: [],
            appScript: {
              uuid: 'uuid',
              appKey: identifiers.app,
              configSchema: {},
              title: extension.configuration.name,
              extensionPointName: 'PAYMENT_METHODS',
            },
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        4,
        identifiers.app,
        api.graphql.AppFunctionSetMutation,
        token,
        {
          uuid: undefined,
          extensionPointName: 'PAYMENT_METHODS',
          title: extension.configuration.name,
          description: extension.configuration.description,
          force: true,
          schemaMajorVersion: '1',
          schemaMinorVersion: '0',
          configurationUi: extension.configuration.configurationUi,
          moduleUploadUrl: uploadUrl,
          apiVersion: extension.configuration.apiVersion,
          appBridge: undefined,
          skipCompilationJob: true,
        },
      )
    })
  })
})
