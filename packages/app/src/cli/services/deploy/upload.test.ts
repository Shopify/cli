import {uploadFunctionExtensions} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {
  UploadUrlGenerateMutation,
  UploadUrlGenerateMutationSchema,
} from '../../api/graphql/functions/upload_url_generate.js'
import {AppFunctionSetMutation, AppFunctionSetMutationSchema} from '../../api/graphql/functions/app_function_set.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {functionProxyRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/http')

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
        input: {
          variables: {
            namespace: 'namespace',
            key: 'key',
          },
        },
      },
      configurationPath: '/function/shopify.function.extension.toml',
      buildWasmPath: '/function/dist/index.wasm',
      inputQueryPath: '/function/input.graphql',
      publishURL: (_) => Promise.resolve(''),
      isJavaScript: false,
      buildCommand: 'make build',
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLError = new Error('upload error')
      vi.mocked(functionProxyRequest).mockRejectedValueOnce(uploadURLError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadURLError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('errors if the upload of the wasm errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
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
      vi.mocked(fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('prints relevant error if the wasm upload returns 400 from file size too large', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

      const mockedFetch = vi.fn().mockResolvedValueOnce({
        status: 400,
        body: {
          read: () => {
            return 'EntityTooLarge'
          },
        },
      })
      vi.mocked(fetch).mockImplementation(mockedFetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new AbortError(
          'The size of the Wasm binary file for Function my-function is too large. It must be less than 200 kb.',
        ),
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('prints relevant error and bugsnags if the wasm upload returns any other error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

      const mockedFetch = vi.fn().mockResolvedValueOnce({
        status: 401,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(fetch).mockImplementation(mockedFetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new AbortError(
          'Something went wrong uploading the Function my-function. The server responded with status 401 and body: error body',
        ),
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('prints general error when status code is 5xx', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

      const mockedFetch = vi.fn().mockResolvedValueOnce({
        status: 500,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(fetch).mockImplementation(mockedFetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new AbortError('Something went wrong uploading the Function my-function. Try again.'),
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('prints general error when status code is 3xx', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)

      const mockedFetch = vi.fn().mockResolvedValueOnce({
        status: 399,
        body: {
          read: () => {
            return 'error body'
          },
        },
      })
      vi.mocked(fetch).mockImplementation(mockedFetch)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        new AbortError('Something went wrong uploading the Function my-function. Try again.'),
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('errors if the compilation request errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
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
      vi.mocked(fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrow(uploadError)

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('errors if the update of the function errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockRejectedValueOnce(updateAppFunctionError)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        updateAppFunctionError,
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
      expect(fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
        id: undefined,
        title: extension.configuration.name,
        description: extension.configuration.description,
        apiType: 'order_discounts',
        apiVersion: extension.configuration.apiVersion,
        appBridge: {
          detailsPath: (extension.configuration.ui?.paths ?? {}).details,
          createPath: (extension.configuration.ui?.paths ?? {}).create,
        },
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enableCreationUi: true,
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('throws if the response from updating the app function contains errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await expect(() => uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
        /The deployment of functions failed with the following errors:/,
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
      expect(fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
        id: undefined,
        title: extension.configuration.name,
        description: extension.configuration.description,
        apiType: 'order_discounts',
        apiVersion: extension.configuration.apiVersion,
        appBridge: {
          detailsPath: (extension.configuration.ui?.paths ?? {}).details,
          createPath: (extension.configuration.ui?.paths ?? {}).create,
        },
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enableCreationUi: true,
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('creates and uploads the function', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      const createdID = 'ulid'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(createdID)
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
      expect(fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
        id: undefined,
        title: extension.configuration.name,
        description: extension.configuration.description,
        apiType: 'order_discounts',
        apiVersion: extension.configuration.apiVersion,
        appBridge: {
          detailsPath: (extension.configuration.ui?.paths ?? {}).details,
          createPath: (extension.configuration.ui?.paths ?? {}).create,
        },
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enableCreationUi: true,
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('appBridge is set to undefined when there is no configuration.ui.paths', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui!.paths = undefined

      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
        id: undefined,
        title: extension.configuration.name,
        description: extension.configuration.description,
        apiType: 'order_discounts',
        apiVersion: extension.configuration.apiVersion,
        appBridge: undefined,
        enableCreationUi: true,
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('inputQueryVariables is set to undefined when there is no configuration.inputs', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.input = undefined

      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
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
        inputQueryVariables: undefined,
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('enableCreationUi is set to false when configuration.ui.enable_create is false', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      extension.configuration.ui!.enable_create = false

      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
        id: undefined,
        title: extension.configuration.name,
        description: extension.configuration.description,
        apiType: 'order_discounts',
        apiVersion: extension.configuration.apiVersion,
        appBridge: {
          detailsPath: (extension.configuration.ui?.paths ?? {}).details,
          createPath: (extension.configuration.ui?.paths ?? {}).create,
        },
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enableCreationUi: false,
        moduleUploadUrl: uploadUrl,
      })
    })
  })

  test('UUID identifier detected and ULID Function ID returned', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const existingID = 'uuid-with-hyphens'
      identifiers.extensions[extension.localIdentifier] = existingID
      const uploadUrl = `test://test.com/moduleId.wasm`
      const updatedID = 'ulid'
      extension.buildWasmPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.buildWasmPath, '')
      const uploadURLResponse: UploadUrlGenerateMutationSchema = {
        data: {
          uploadUrlGenerate: {
            headers: {},
            maxSize: '200',
            url: uploadUrl,
          },
        },
      }
      const functionSetMutationResponse: AppFunctionSetMutationSchema = {
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
      vi.mocked(fetch).mockImplementation(vi.fn().mockResolvedValueOnce({status: 200}))
      vi.mocked(functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      const got = await uploadFunctionExtensions([extension], {token, identifiers})

      // Then
      expect(got.extensions[extension.localIdentifier]).toEqual(updatedID)
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
      expect(fetch).toHaveBeenCalledWith(uploadUrl, {
        body: Buffer.from(''),
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(functionProxyRequest).toHaveBeenNthCalledWith(2, identifiers.app, AppFunctionSetMutation, token, {
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
        inputQueryVariables: {
          singleJsonMetafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enableCreationUi: true,
        moduleUploadUrl: uploadUrl,
      })
    })
  })
})
