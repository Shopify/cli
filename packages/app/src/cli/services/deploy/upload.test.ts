import {uploadFunctionExtensions} from './upload'
import {FunctionExtension, Identifiers} from 'cli/models/app/app'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {temporary} from '@shopify/cli-testing'
import {path, file, api, http} from '@shopify/cli-kit'

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
        type: 'payment_methods',
        description: 'my function',
        build: {
          command: 'make build',
          path: 'dist/index.wasm',
        },
        configurationUi: false,
        version: '2',
      },
      configurationPath: '/function/shopify.function.extension.toml',
      buildWasmPath: () => '/function/dist/index.wasm',
      inputQueryPath: () => '/function/input.query',
      idEnvironmentVariableName: 'SHOPIFY_FUNCTION_ID',
      localIdentifier: 'function',
      // eslint-disable-next-line @typescript-eslint/naming-convention
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
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
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

  test('errors if the update of the function errors', async () => {
    await temporary.directory(async (tmpDir) => {
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
      const functionSetMutationResponse = {
        data: {
          appScriptSet: {
            userErrors: [],
            appScript: {
              uuid: createdUUID,
            },
          },
        },
      }
      const updateAppFunctionError = new Error('error')
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(api.partners.functionProxyRequest).mockRejectedValueOnce(updateAppFunctionError)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
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
        body: '',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          scriptConfigVersion: extension.configuration.version,
          configurationUi: extension.configuration.configurationUi,
          configurationDefinition: JSON.stringify(extension.configuration.metaObject ?? {}),
          moduleUploadUrl: uploadUrl,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })

  test('throws if the response from updating the app function contains errors', async () => {
    await temporary.directory(async (tmpDir) => {
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
      vi.mocked(api.partners.functionProxyRequest).mockResolvedValueOnce(functionSetMutationResponse)

      // When
      await expect(uploadFunctionExtensions([extension], {token, identifiers})).rejects.toThrowError(
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
        body: '',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          scriptConfigVersion: extension.configuration.version,
          configurationUi: extension.configuration.configurationUi,
          configurationDefinition: JSON.stringify(extension.configuration.metaObject ?? {}),
          moduleUploadUrl: uploadUrl,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })

  test('creates and uploads the function', async () => {
    await temporary.directory(async (tmpDir) => {
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
        body: '',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: {'Content-Type': 'application/wasm'},
        method: 'PUT',
      })
      expect(api.partners.functionProxyRequest).toHaveBeenNthCalledWith(
        2,
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
          scriptConfigVersion: extension.configuration.version,
          configurationUi: extension.configuration.configurationUi,
          configurationDefinition: JSON.stringify(extension.configuration.metaObject ?? {}),
          moduleUploadUrl: uploadUrl,
          appBridge: {
            detailsPath: (extension.configuration.ui?.paths ?? {}).details,
            createPath: (extension.configuration.ui?.paths ?? {}).create,
          },
        },
      )
    })
  })
})
