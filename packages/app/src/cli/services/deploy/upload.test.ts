import {deploymentErrorsToCustomSections, uploadExtensionsBundle, uploadFunctionExtensions} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {
  UploadUrlGenerateMutation,
  UploadUrlGenerateMutationSchema,
} from '../../api/graphql/functions/upload_url_generate.js'
import {AppFunctionSetMutation, AppFunctionSetMutationSchema} from '../../api/graphql/functions/app_function_set.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {functionProxyRequest, partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/crypto')

describe('uploadFunctionExtensions', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let identifiers: Identifiers
  let token: string

  beforeEach(async () => {
    extension = await testFunctionExtension({
      dir: '/my-function',
      config: {
        name: 'my-function',
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
        configuration_ui: false,
        api_version: '2022-07',
        input: {
          variables: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        metafields: [],
      },
    })

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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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

  test('prints unsupported api version error if any user errors are returned with version_unsupported_error tag', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = `test://test.com/moduleId.wasm`
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
                field: '',
                message: "Version '2022-07' for 'product_discounts' is unsupported.",
                tag: 'version_unsupported_error',
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
        /Deployment failed due to an outdated API version/,
      )

      // Then
      expect(functionProxyRequest).toHaveBeenNthCalledWith(1, identifiers.app, UploadUrlGenerateMutation, token)
    })
  })

  test('prints relevant error if the wasm upload returns 400 from file size too large', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
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
        apiVersion: extension.configuration.api_version,
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
          appVersionGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          appDeploy: {
            appVersion: {
              appModuleVersions: [],
            },
            id: '2',
          },
        })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')
      await uploadExtensionsBundle({
        apiKey: 'app-id',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [{uuid: '123', config: '{}', context: '', handle: 'handle'}],
        token: 'api-token',
        extensionIds: {},
        release: true,
      })

      // Then
      expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
        apiKey: 'app-id',
        bundleUrl: 'signed-upload-url',
        appModules: [
          {
            config: '{}',
            context: '',
            uuid: '123',
            handle: 'handle',
          },
        ],
        skipPublish: false,
      })
    })
  })

  test('calls a mutation on partners with a message and a version', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
      vi.mocked(partnersRequest)
        .mockResolvedValueOnce({
          appVersionGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          appDeploy: {
            appVersion: {
              appModuleVersions: [],
            },
            id: '2',
          },
        })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')
      await uploadExtensionsBundle({
        apiKey: 'app-id',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [{uuid: '123', config: '{}', context: '', handle: 'handle'}],
        token: 'api-token',
        extensionIds: {},
        release: true,
        message: 'test',
        version: '1.0.0',
      })

      // Then
      expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
        apiKey: 'app-id',
        bundleUrl: 'signed-upload-url',
        appModules: [
          {
            config: '{}',
            context: '',
            uuid: '123',
            handle: 'handle',
          },
        ],
        skipPublish: false,
        message: 'test',
        versionTag: '1.0.0',
      })
    })
  })

  test('calls a mutation on partners when there are no extensions', async () => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      appDeploy: {
        appVersion: {
          appModuleVersions: [],
        },
        id: '2',
      },
    })
    const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
    vi.mocked<any>(formData).mockReturnValue(mockedFormData)
    // When
    await uploadExtensionsBundle({
      apiKey: 'app-id',
      bundlePath: undefined,
      appModules: [],
      token: 'api-token',
      extensionIds: {},
      release: true,
    })

    // Then
    expect(vi.mocked(partnersRequest).mock.calls[0]![2]!).toEqual({
      apiKey: 'app-id',
      skipPublish: false,
      message: undefined,
      versionTag: undefined,
      commitReferences: undefined,
    })
    expect(partnersRequest).toHaveBeenCalledOnce()
  })

  test("throws a specific error based on what is returned from partners when response doesn't include an app version", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
      vi.mocked(partnersRequest)
        .mockResolvedValueOnce({
          appVersionGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          appDeploy: {
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
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')

      // Then
      try {
        await uploadExtensionsBundle({
          apiKey: 'app-id',
          bundlePath: joinPath(tmpDir, 'test.zip'),
          appModules: [
            {uuid: '123', config: '{}', context: '', handle: 'handle'},
            {uuid: '456', config: '{}', context: '', handle: 'handle'},
          ],
          token: 'api-token',
          extensionIds: {
            'amortizable-marketplace-ext': '123',
            'amortizable-marketplace-ext-2': '456',
          },
          release: true,
        })

        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: any) {
        expect(error.message).toEqual("Version couldn't be created.")
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

  test('return a deploy error message based on what is returned from partners when response includes an app version', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('api-token')
      vi.mocked(partnersRequest)
        .mockResolvedValueOnce({
          appVersionGenerateSignedUploadUrl: {
            signedUploadUrl: 'signed-upload-url',
          },
        })
        .mockResolvedValueOnce({
          appDeploy: {
            appVersion: {
              uuid: 'appVersion-uuid',
              id: 1,
              versionTag: 'versionTag',
              appModuleVersions: [
                {
                  uuid: 'app-module-uuid',
                  registrationId: 'registration-uuid',
                  validationErrors: [],
                },
              ],
            },
            userErrors: [
              {
                field: [],
                message: 'No release error message.',
                category: '',
                details: [],
              },
            ],
          },
        })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      await writeFile(joinPath(tmpDir, 'test.zip'), '')

      // When
      const result = await uploadExtensionsBundle({
        apiKey: 'app-id',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [
          {uuid: '123', config: '{}', context: '', handle: 'handle'},
          {uuid: '456', config: '{}', context: '', handle: 'handle'},
        ],
        token: 'api-token',
        extensionIds: {
          'amortizable-marketplace-ext': '123',
          'amortizable-marketplace-ext-2': '456',
        },
        release: true,
      })

      // Then
      expect(result).toEqual({
        validationErrors: [],
        versionTag: 'versionTag',
        deployError: 'No release error message.',
      })
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
            extension_title: 't:remote-title',
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
            extension_title: 't:remote-title',
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
        // Uses name from identifiers and not from remote `extension_title`
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

  test('returns an array of custom sections when given a single generic error message', () => {
    // Given
    const errors = [
      {
        field: [],
        message: 'First error message.',
        category: '',
        details: [],
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
        body: 'First error message.',
      },
    ])
  })

  test('returns an array of custom sections when given multiple generic error messages', () => {
    // Given
    const errors = [
      {
        field: [],
        message: 'First error message.',
        category: '',
        details: [],
      },
      {
        field: [],
        message: 'Second error message.',
        category: '',
        details: [],
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
        body: {
          list: {
            items: ['First error message.', 'Second error message.'],
          },
        },
      },
    ])
  })

  test('returns a specific error message when the error is about the version being already taken', () => {
    // Given
    const errors = [
      {
        field: ['version_tag'],
        message: 'has already been taken',
        category: '',
        details: [],
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(
      errors,
      {
        'amortizable-marketplace-ext': '123',
        'amortizable-marketplace-ext-2': '456',
      },
      {
        version: 'already-taken-version',
      },
    )

    // Then
    expect(customSections).toEqual([
      {
        body: [
          'An app version with the name',
          {userInput: 'already-taken-version'},
          'already exists. Deploy again with a different version name.',
        ],
      },
    ])
  })
})
