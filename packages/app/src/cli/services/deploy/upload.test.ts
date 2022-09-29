import {uploadFunctionExtensions} from './upload.js'
import {blocks} from '../../constants.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {error, path, file, api, http} from '@shopify/cli-kit'

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
        type: 'order_discounts',
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
      metadata: {schemaVersions: {order_discounts: {major: 1, minor: 0}}},
      type: 'order_discounts',
      graphQLType: 'order_discounts',
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
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the upload of the wasm errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
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
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('prints relevant error if the wasm upload returns 400 from file size too large', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
          },
        },
      }
      const uploadError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation(compilationJobId)

      const fetch = vi.fn().mockResolvedValueOnce({
        status: 400,
        body: {
          read: () => {
            return 'EntityTooLarge'
          },
        },
      })
      vi.mocked(http.fetch).mockImplementation(fetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new error.Abort(
          'The size of the Wasm binary file for Function my-function is too large. It must be less than 200 kb.',
        ),
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('prints relevant error and bugsnags if the wasm upload returns any other error', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation(compilationJobId)

      const fetch = vi.fn().mockResolvedValueOnce({
        status: 401,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(http.fetch).mockImplementation(fetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new error.Bug(
          'Something went wrong uploading the Function my-function. The server responded with status 401 and body: error body',
        ),
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('prints general error when status code is 5xx', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation(compilationJobId)

      const fetch = vi.fn().mockResolvedValueOnce({
        status: 500,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(http.fetch).mockImplementation(fetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new error.Abort('Something went wrong uploading the Function my-function. Try again.'),
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('prints general error when status code is 3xx', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      const compilationJobId = 'job-id'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      mockFunctionCompilation(compilationJobId)

      const fetch = vi.fn().mockResolvedValueOnce({
        status: 399,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(http.fetch).mockImplementation(fetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new error.Abort('Something went wrong uploading the Function my-function. Try again.'),
      )

      // Then
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the compilation request errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
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
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
    })
  })

  test('errors if the compilation fails', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
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
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        /Function my-function compilation failed./,
      )
    })
  })

  test('errors if the compilation times out', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      vi.spyOn(blocks.functions, 'compilationStatusWaitMs', 'get').mockReturnValue(1 as never)

      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
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
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))

      // When
      const promise = () => uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      await expect(promise).rejects.toThrowError(/Function my-function compilation timed out./)
    })
  })

  test('errors if the update of the function errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const updateAppFunctionError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
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
        api.graphql.UploadUrlGenerateMutation,
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
          id: undefined,
          title: extension.configuration.name,
          description: extension.configuration.description,
          apiType: 'order_discounts',
          apiVersion: extension.configuration.apiVersion,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('throws if the response from updating the app function contains errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          functionSet: {
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
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
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
        api.graphql.UploadUrlGenerateMutation,
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
          id: undefined,
          title: extension.configuration.name,
          description: extension.configuration.description,
          apiType: 'order_discounts',
          apiVersion: extension.configuration.apiVersion,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('creates and uploads the function', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      const createdID = 'ulid'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          functionSet: {
            userErrors: [],
            function: {
              id: createdID,
            },
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(createdID)
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
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
          id: undefined,
          title: extension.configuration.name,
          description: extension.configuration.description,
          apiType: 'order_discounts',
          apiVersion: extension.configuration.apiVersion,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('appBridge is set to undefined when there is no configuration.ui.paths', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui = undefined

      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          functionSet: {
            userErrors: [],
            function: {
              id: 'uuid',
            },
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
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
          id: undefined,
          title: extension.configuration.name,
          description: extension.configuration.description,
          apiType: 'order_discounts',
          apiVersion: extension.configuration.apiVersion,
          appBridge: undefined,
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('UUID identifier detected and ULID Function ID returned', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const existingID = 'uuid-with-hyphens'
      identifiers.extensions[extension.localIdentifier] = existingID
      const uploadUrl = `test://test.com/moduleId.wasm`
      const updatedID = 'ulid'
      extension.buildWasmPath = () => path.join(tmpDir, 'index.wasm')
      await file.write(extension.buildWasmPath(), '')
      const uploadURLResponse: api.graphql.UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: api.graphql.AppFunctionSetMutationSchema = {
        data: {
          functionSet: {
            userErrors: [],
            function: {
              id: updatedID,
            },
          },
        },
      }
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      mockFunctionCompilation()
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(updatedID)
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
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
          id: undefined,
          legacyUuid: existingID,
          title: extension.configuration.name,
          description: extension.configuration.description,
          apiType: 'order_discounts',
          apiVersion: extension.configuration.apiVersion,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })
})
