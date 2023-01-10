import {uploadFunctionExtensions} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {error, path, file, api, http} from '@shopify/cli-kit'
import {functionProxyRequest} from '@shopify/cli-kit/node/api/partners'

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/api/partners')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
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
          enable_create: true,
        },
        configurationUi: false,
        apiVersion: '2022-07',
      },
      configurationPath: '/function/shopify.function.extension.toml',
      buildWasmPath: () => '/function/dist/index.wasm',
      inputQueryPath: () => '/function/input.graphql',
      publishURL: (_) => Promise.resolve(''),
      externalType: 'order_discounts',
      idEnvironmentVariableName: 'SHOPIFY_FUNCTION_ID',
      localIdentifier: 'my-function',
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
      vi.mocked(functionProxyRequest).mockRejectedValueOnce(uploadURLError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadURLError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        1,
        identifiers.app,
        api.graphql.UploadUrlGenerateMutation,
        token,
      )
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockRejectedValueOnce(updateAppFunctionError)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        updateAppFunctionError,
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: true,
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        /The deployment of functions failed with the following errors:/,
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: true,
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(createdID)
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: true,
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('appBridge is set to undefined when there is no configuration.ui.paths', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui!.paths = undefined

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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: true,
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })

  test('enableCreationUi is set to false when configuration.ui.enable_create is false', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui!.enable_create = false

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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: false,
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
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(http.fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(updatedID)
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
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
      expect(functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          enableCreationUi: true,
          moduleUploadUrl: uploadUrl,
        },
      )
    })
  })
})
