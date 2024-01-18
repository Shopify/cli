import {deploymentErrorsToCustomSections, uploadExtensionsBundle, uploadWasmBlob} from './upload.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {
  FunctionUploadUrlGenerateResponse,
  getFunctionUploadUrl,
  partnersRequest,
} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/crypto')

describe('uploadWasmBlob', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let identifiers: Identifiers
  let apiKey: string
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
    apiKey = 'api-key'
    token = 'token'
    identifiers = {
      app: 'api=key',
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
  })

  test('returns the url and moduleId successfully', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const url = 'url'
      const moduleId = '1698984f-7848-4b9a-9c07-4c0bce7e68e1'
      const uploadURLResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            url,
            moduleId,
            headers: {},
            maxSize: '256 KB',
            maxBytes: 200,
          },
        },
      }
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)

      const mockedFetch = vi.fn().mockResolvedValueOnce({
        status: 200,
      })
      vi.mocked(fetch).mockImplementation(mockedFetch)

      // When
      await expect(
        uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token),
      ).resolves.toStrictEqual({
        url,
        moduleId,
      })

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('throws an error if the request to return the url errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLError = new Error('upload error')
      vi.mocked(getFunctionUploadUrl).mockRejectedValueOnce(uploadURLError)

      // When
      await expect(uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token)).rejects.toThrow(
        uploadURLError,
      )

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('errors if the upload of the wasm errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLResponse: FunctionUploadUrlGenerateResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
            moduleId: 'module-id',
            maxBytes: 200,
          },
        },
      }
      const uploadError = new Error('error')
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)
      vi.mocked(fetch).mockRejectedValue(uploadError)

      // When
      await expect(uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token)).rejects.toThrow(
        uploadError,
      )

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('prints relevant error if the wasm upload returns 400 from file size too large', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLResponse: FunctionUploadUrlGenerateResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
            moduleId: 'module-id',
            maxBytes: 200,
          },
        },
      }
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)

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
      await expect(() =>
        uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token),
      ).rejects.toThrowError(
        new AbortError(
          'The size of the Wasm binary file for Function my-function is too large. It must be less than 200 kb.',
        ),
      )

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('prints relevant error and bugsnags if the wasm upload returns any other error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLResponse: FunctionUploadUrlGenerateResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
            moduleId: 'module-id',
            maxBytes: 200,
          },
        },
      }
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)

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
      await expect(() =>
        uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token),
      ).rejects.toThrowError(
        new AbortError(
          'Something went wrong uploading the Function my-function. The server responded with status 401 and body: error body',
        ),
      )

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('prints general error when status code is 5xx', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLResponse: FunctionUploadUrlGenerateResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
            moduleId: 'module-id',
            maxBytes: 200,
          },
        },
      }
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)

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
      await expect(() =>
        uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token),
      ).rejects.toThrowError(new AbortError('Something went wrong uploading the Function my-function. Try again.'))

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
    })
  })

  test('prints general error when status code is 3xx', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uploadUrl = 'test://test.com/moduleId.wasm'
      extension.outputPath = joinPath(tmpDir, 'index.wasm')
      await writeFile(extension.outputPath, '')
      const uploadURLResponse: FunctionUploadUrlGenerateResponse = {
        functionUploadUrlGenerate: {
          generatedUrlDetails: {
            headers: {},
            maxSize: '200 kb',
            url: uploadUrl,
            moduleId: 'module-id',
            maxBytes: 200,
          },
        },
      }
      vi.mocked(getFunctionUploadUrl).mockResolvedValueOnce(uploadURLResponse)

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
      await expect(() =>
        uploadWasmBlob(extension.localIdentifier, extension.outputPath, apiKey, token),
      ).rejects.toThrowError(new AbortError('Something went wrong uploading the Function my-function. Try again.'))

      // Then
      expect(getFunctionUploadUrl).toHaveBeenNthCalledWith(1, token)
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
