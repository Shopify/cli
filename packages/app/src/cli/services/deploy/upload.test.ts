import {
  deploymentErrorsToCustomSections,
  uploadExtensionsBundle,
  uploadFunctionExtensions,
  functionConfiguration,
} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {
  UploadUrlGenerateMutation,
  UploadUrlGenerateMutationSchema,
} from '../../api/graphql/functions/upload_url_generate.js'
import {AppFunctionSetMutation, AppFunctionSetMutationSchema} from '../../api/graphql/functions/app_function_set.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {functionProxyRequest, partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/crypto')

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
      usingExtensionsFramework: false,
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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
            moduleId: 'module-id',
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

describe('uploadExtensionsBundle', () => {
  test('calls a mutation on partners', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
      vi.mocked(partnersRequest)
        .mockResolvedValueOnce({
          deploymentGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          deploymentCreate: {
            deployment: {
              deployedVersions: [],
            },
            id: '2',
          },
        })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      vi.mocked(randomUUID).mockReturnValue('random-uuid')
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')
      await uploadExtensionsBundle({
        apiKey: 'app-id',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        extensions: [{uuid: '123', config: '{}', context: ''}],
        token: 'api-token',
        extensionIds: {},
      })

      // Then
      expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
        apiKey: 'app-id',
        bundleUrl: 'signed-upload-url',
        extensions: [
          {
            config: '{}',
            context: '',
            uuid: '123',
          },
        ],
        uuid: 'random-uuid',
      })
    })
  })

  test('calls a mutation on partners when there are no extensions', async () => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      deploymentCreate: {
        deployment: {
          deployedVersions: [],
        },
        id: '2',
      },
    })
    const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
    vi.mocked<any>(formData).mockReturnValue(mockedFormData)
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    // When
    await uploadExtensionsBundle({
      apiKey: 'app-id',
      bundlePath: undefined,
      extensions: [],
      token: 'api-token',
      extensionIds: {},
    })

    // Then
    expect(vi.mocked(partnersRequest).mock.calls[0]![2]!).toEqual({
      apiKey: 'app-id',
      uuid: 'random-uuid',
    })
    expect(partnersRequest).toHaveBeenCalledOnce()
  })

  test('throws an error based on what is returned from partners', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
      vi.mocked(partnersRequest)
        .mockResolvedValueOnce({
          deploymentGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          deploymentCreate: {
            userErrors: [
              {
                message: 'Missing expected key(s).',
                field: ['base'],
                category: 'invalid',
                details: [
                  {
                    extension_id: 123,
                    extension_title: 'amortizable-marketplace-ext',
                  },
                ],
              },
              {
                message: 'is blank',
                field: ['title'],
                category: 'invalid',
                details: [
                  {
                    extension_id: 456,
                    extension_title: 'amortizable-marketplace-ext-2',
                  },
                ],
              },
              {
                message: 'Some other error',
                category: 'unknown',
                field: ['base'],
                details: [
                  {
                    extension_id: 123,
                    extension_title: 'amortizable-marketplace-ext',
                  },
                ],
              },
              {
                message: 'Something was not found',
                category: 'not_found',
                field: ['base'],
                details: [
                  {
                    extension_id: 456,
                    extension_title: 'amortizable-marketplace-ext-2',
                  },
                ],
              },
              {
                message: 'is blank',
                field: ['title'],
                category: 'invalid',
                details: [
                  {
                    extension_id: 999,
                    extension_title: 'admin-link',
                  },
                ],
              },
            ],
          },
        })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      vi.mocked(randomUUID).mockReturnValue('random-uuid')
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')

      // Then
      try {
        await uploadExtensionsBundle({
          apiKey: 'app-id',
          bundlePath: joinPath(tmpDir, 'test.zip'),
          extensions: [
            {uuid: '123', config: '{}', context: ''},
            {uuid: '456', config: '{}', context: ''},
          ],
          token: 'api-token',
          extensionIds: {
            'amortizable-marketplace-ext': '123',
            'amortizable-marketplace-ext-2': '456',
          },
        })

        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: any) {
        expect(error.message).toEqual('There has been an error creating your deployment.')
        expect(error.customSections).toEqual([
          {
            title: 'amortizable-marketplace-ext',
            body: [
              {
                list: {
                  title: '\n',
                  items: ['Some other error'],
                },
              },
              {
                list: {
                  title: '\nValidation errors',
                  items: ['Missing expected key(s).'],
                },
              },
            ],
          },
          {
            title: 'amortizable-marketplace-ext-2',
            body: [
              {
                list: {
                  title: '\n',
                  items: ['Something was not found'],
                },
              },
              {
                list: {
                  title: '\nValidation errors',
                  items: ['title: is blank'],
                },
              },
            ],
          },
          {
            title: 'admin-link',
            body: '\n1 error found in your extension. Fix these issues in the Partner Dashboard and try deploying again.',
          },
        ])
      }
    })
  })
})

describe('deploymentErrorsToCustomSections', () => {
  test('returns an array of custom sections', () => {
    // Given
    const errors = [
      {
        field: ['base'],
        message: 'Missing expected key(s).',
        category: 'invalid',
        details: [
          {
            extension_id: 123,
            extension_title: 'amortizable-marketplace-ext',
          },
        ],
      },
      {
        field: ['base'],
        message: 'Some other error',
        category: 'unknown',
        details: [
          {
            extension_id: 123,
            extension_title: 'amortizable-marketplace-ext',
          },
        ],
      },
      {
        field: ['base'],
        message: 'Something was not found',
        category: 'not_found',
        details: [
          {
            extension_id: 456,
            extension_title: 'amortizable-marketplace-ext-2',
          },
        ],
      },
      {
        message: 'is blank',
        field: ['title'],
        category: 'invalid',
        details: [
          {
            extension_id: 456,
            extension_title: 'amortizable-marketplace-ext-2',
          },
        ],
      },
      {
        message: 'is blank',
        field: ['title'],
        category: 'invalid',
        details: [
          {
            extension_id: 999,
            extension_title: 'admin-link',
          },
        ],
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(errors, {
      'amortizable-marketplace-ext': '123',
      'amortizable-marketplace-ext-2': '456',
    })

    // Then
    expect(customSections).toEqual([
      {
        title: 'amortizable-marketplace-ext',
        body: [
          {
            list: {
              title: '\n',
              items: ['Some other error'],
            },
          },
          {
            list: {
              title: '\nValidation errors',
              items: ['Missing expected key(s).'],
            },
          },
        ],
      },
      {
        title: 'amortizable-marketplace-ext-2',
        body: [
          {
            list: {
              title: '\n',
              items: ['Something was not found'],
            },
          },
          {
            list: {
              title: '\nValidation errors',
              items: ['title: is blank'],
            },
          },
        ],
      },
      {
        title: 'admin-link',
        body: '\n1 error found in your extension. Fix these issues in the Partner Dashboard and try deploying again.',
      },
    ])
  })
})

describe('functionConfiguration', () => {
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
      inputQueryPath: 'input.graphql',
      publishURL: (_) => Promise.resolve(''),
      isJavaScript: false,
      buildCommand: 'make build',
      externalType: 'order_discounts',
      idEnvironmentVariableName: 'SHOPIFY_FUNCTION_ID',
      localIdentifier: 'my-function',
      type: 'order_discounts',
      graphQLType: 'order_discounts',
      usingExtensionsFramework: false,
    }
    token = 'token'
    identifiers = {
      app: 'api=key',
      extensions: {},
      extensionIds: {},
    }
  })

  test('returns a snake_case object with all possible fields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const moduleId = 'module_id'
      const appKey = 'app-key'
      const inputQuery = 'inputQuery'
      extension.inputQueryPath = joinPath(tmpDir, extension.inputQueryPath)
      await writeFile(extension.inputQueryPath, inputQuery)

      // When
      const got = await functionConfiguration(extension, moduleId, appKey)

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: appKey,
        api_type: 'order_discounts',
        api_version: extension.configuration.apiVersion,
        ui: {
          app_bridge: {
            details_path: extension.configuration.ui!.paths!.details,
            create_path: extension.configuration.ui!.paths!.create,
          },
        },
        input_query: inputQuery,
        input_query_variables: {
          single_json_metafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enable_creation_ui: true,
        module_id: moduleId,
      })
    })
  })

  test('returns a snake_case object with only required fields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const moduleId = 'module_id'
      const appKey = 'app-key'
      extension.configuration.input = undefined
      extension.configuration.ui = undefined

      // When
      const got = await functionConfiguration(extension, moduleId, appKey)

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: appKey,
        api_type: 'order_discounts',
        api_version: extension.configuration.apiVersion,
        module_id: moduleId,
        enable_creation_ui: true,
        input_query: undefined,
        input_query_variabels: undefined,
        ui: undefined,
      })
    })
  })
})
