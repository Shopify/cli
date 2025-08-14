import {deploymentErrorsToCustomSections, uploadExtensionsBundle} from './upload.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {formData} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/crypto')

describe('uploadExtensionsBundle', () => {
  test('calls a mutation on partners', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')
      await uploadExtensionsBundle({
        appId: '1',
        apiKey: 'app-id',
        name: 'appName',
        organizationId: '1',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [
          {uuid: '123', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
        ],
        developerPlatformClient,
        extensionIds: {},
        release: true,
      })

      // Then
      expect(developerPlatformClient.deploy).toHaveBeenCalledWith({
        appId: '1',
        apiKey: 'app-id',
        name: 'appName',
        organizationId: '1',
        bundleUrl: 'signed-upload-url',
        appModules: [
          {
            config: '{}',
            context: '',
            uuid: '123',
            handle: 'handle',
            specificationIdentifier: 'ui_extension',
          },
        ],
        skipPublish: false,
      })
    })
  })

  test('calls a mutation on partners with a message and a version', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')
      await uploadExtensionsBundle({
        appId: '1',
        apiKey: 'app-id',
        name: 'appName',
        organizationId: '1',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [
          {uuid: '123', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
        ],
        developerPlatformClient,
        extensionIds: {},
        release: true,
        message: 'test',
        version: '1.0.0',
      })

      // Then
      expect(developerPlatformClient.deploy).toHaveBeenCalledWith({
        appId: '1',
        apiKey: 'app-id',
        name: 'appName',
        organizationId: '1',
        bundleUrl: 'signed-upload-url',
        appModules: [
          {
            config: '{}',
            context: '',
            uuid: '123',
            handle: 'handle',
            specificationIdentifier: 'ui_extension',
          },
        ],
        skipPublish: false,
        message: 'test',
        versionTag: '1.0.0',
      })
    })
  })

  test('calls a mutation on partners when there are no extensions', async () => {
    const developerPlatformClient = testDeveloperPlatformClient()
    const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
    vi.mocked<any>(formData).mockReturnValue(mockedFormData)
    // When
    await uploadExtensionsBundle({
      appId: '1',
      apiKey: 'app-id',
      name: 'appName',
      organizationId: '1',
      bundlePath: undefined,
      appModules: [],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })

    // Then
    expect(developerPlatformClient.deploy).toHaveBeenCalledWith({
      appId: '1',
      apiKey: 'app-id',
      name: 'appName',
      organizationId: '1',
      skipPublish: false,
      message: undefined,
      versionTag: undefined,
      commitReference: undefined,
    })
  })

  test("throws a specific error based on what is returned from partners when response doesn't include an app version", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const errorResponse: AppDeploySchema = {
        appDeploy: {
          appVersion: {
            uuid: 'uuid',
            id: 1,
            versionTag: 'version-tag',
            location: 'location',
            message: 'message',
            appModuleVersions: [],
          },
          userErrors: [
            {
              message: 'Missing expected key(s).',
              field: ['base'],
              category: 'invalid',
              details: [
                {
                  extension_id: 123,
                  extension_title: 'amortizable-marketplace-ext',
                  specification_identifier: 'ui_extension',
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
                  specification_identifier: 'ui_extension',
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
                  specification_identifier: 'ui_extension',
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
                  specification_identifier: 'ui_extension',
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
                  specification_identifier: 'ui_extension',
                },
              ],
            },
          ],
        },
      }
      const developerPlatformClient = testDeveloperPlatformClient({
        deploy: (_input: AppDeployVariables) => Promise.resolve(errorResponse),
      })

      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      // When
      await writeFile(joinPath(tmpDir, 'test.zip'), '')

      // Then
      try {
        await uploadExtensionsBundle({
          appId: '1',
          apiKey: 'app-id',
          name: 'appName',
          organizationId: '1',
          bundlePath: joinPath(tmpDir, 'test.zip'),
          appModules: [
            {uuid: '123', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
            {uuid: '456', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
          ],
          developerPlatformClient,
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
      const errorResponse: AppDeploySchema = {
        appDeploy: {
          appVersion: {
            uuid: 'appVersion-uuid',
            id: 1,
            location: 'location',
            message: 'message',
            versionTag: 'versionTag',
            appModuleVersions: [
              {
                uuid: 'app-module-uuid',
                registrationUuid: 'registration-uuid',
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
      }
      const developerPlatformClient = testDeveloperPlatformClient({
        deploy: (_input: AppDeployVariables) => Promise.resolve(errorResponse),
      })
      const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
      vi.mocked<any>(formData).mockReturnValue(mockedFormData)
      await writeFile(joinPath(tmpDir, 'test.zip'), '')

      // When
      const result = await uploadExtensionsBundle({
        appId: '1',
        apiKey: 'app-id',
        name: 'appName',
        organizationId: '1',
        bundlePath: joinPath(tmpDir, 'test.zip'),
        appModules: [
          {uuid: '123', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
          {uuid: '456', config: '{}', context: '', handle: 'handle', specificationIdentifier: 'ui_extension'},
        ],
        developerPlatformClient,
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
        location: 'location',
        message: 'message',
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
            specification_identifier: 'ui_extension',
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
            specification_identifier: 'ui_extension',
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
            specification_identifier: 'ui_extension',
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
            specification_identifier: 'ui_extension',
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
            specification_identifier: 'ui_extension',
          },
        ],
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(
      errors,
      {
        'amortizable-marketplace-ext': '123',
        'amortizable-marketplace-ext-2': '456',
      },
      [],
    )

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
    const customSections = deploymentErrorsToCustomSections(
      errors,
      {
        'amortizable-marketplace-ext': '123',
        'amortizable-marketplace-ext-2': '456',
      },
      [],
    )

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
    const customSections = deploymentErrorsToCustomSections(
      errors,
      {
        'amortizable-marketplace-ext': '123',
        'amortizable-marketplace-ext-2': '456',
      },
      [],
    )

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
      [],
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

  test('returns Webhook Subscription as the title for webhook subscription extensions', () => {
    // Given
    const errors = [
      {
        field: ['webhook_subscription'],
        message: 'The following topic is invalid: products/wrong',
        category: 'invalid',
        details: [
          {
            extension_id: 686809612289,
            extension_title: 'b05ef3d6a573863fa3b21fae7689f1',
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(
      errors,
      {
        b05ef3d6a573863fa3b21fae7689f1: '686809612289',
      },
      [],
    )

    // Then
    expect(customSections).toEqual([
      {
        body: [
          {
            list: {
              items: ['webhook_subscription: The following topic is invalid: products/wrong'],
              title: '\nValidation errors',
            },
          },
        ],
        title: 'Webhook Subscription',
      },
    ])
  })

  test('does not return duplicate error messages', () => {
    // Given
    const errors = [
      {
        field: ['first_field'],
        message: 'First error message.',
        category: 'invalid',
        details: [
          {
            extension_title: 'webhook-subscription-1',
            extension_id: 1,
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
      {
        field: ['second_field'],
        message: 'Second error message.',
        category: 'invalid',
        details: [
          {
            extension_title: 'webhook-subscription-2',
            extension_id: 2,
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
      {
        field: ['first_field'],
        message: 'First error message.',
        category: 'invalid',
        details: [
          {
            extension_title: 'webhook-subscription-3',
            extension_id: 3,
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
      {
        field: ['some_other_field'],
        message: 'Second error message.',
        category: 'invalid',
        details: [
          {
            extension_title: 'webhook-subscription-4',
            extension_id: 4,
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
      {
        field: ['second_field'],
        message: 'Some other error message.',
        category: 'invalid',
        details: [
          {
            extension_title: 'webhook-subscription-5',
            extension_id: 5,
            specification_identifier: 'webhook_subscription',
          },
        ],
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(
      errors as AppDeploySchema['appDeploy']['userErrors'],
      {
        'webhook-subscription-1': '1',
        'webhook-subscription-2': '2',
        'webhook-subscription-3': '3',
        'webhook-subscription-4': '4',
        'webhook-subscription-5': '5',
      },
      [],
    )

    // Then
    expect(customSections).toEqual([
      {
        body: [
          {
            list: {
              items: [
                'first_field: First error message.',
                'second_field: Second error message.',
                'some_other_field: Second error message.',
                'second_field: Some other error message.',
              ],
              title: '\nValidation errors',
            },
          },
        ],
        title: 'Webhook Subscription',
      },
    ])
  })

  test('returns sections for app management validation errors with found appModules', () => {
    // Given
    const errors = [
      {
        field: ['supported_buyer_contexts', 'currency'],
        message: 'must be a valid uppercase alpha-3 ISO 4217 value, invalid value: CADs',
        category: 'invalid',
        on: [
          {
            type: 'app_module',
            app_module_uuid: '0198a414-9812-7907-820c-773de19dede3',
            version_uuid: '0198a7a2-81fd-733d-b63c-1afe052b7fb3',
            specification_identifier: 'payments_extension',
            user_identifier: 'my-payment-extension-uid',
          },
        ],
        details: [],
      },
      {
        field: ['targeting', 'target'],
        message: 'is required',
        category: 'invalid',
        on: [
          {
            type: 'app_module',
            user_identifier: 'my-discount-extension-uid',
          },
        ],
        details: [],
      },
      {
        field: ['name'],
        message: 'is too long',
        category: 'invalid',
        on: [
          {
            type: 'app_module',
            user_identifier: 'my-payment-extension-uid',
          },
        ],
        details: [],
      },
    ]

    const appModules = [
      {
        uid: 'my-payment-extension-uid',
        handle: 'my-payment-extension',
        config: '{}',
        context: '',
        specificationIdentifier: 'payments_extension',
      },
      {
        uid: 'my-discount-extension-uid',
        handle: 'my-discount-function',
        config: '{}',
        context: '',
        specificationIdentifier: 'discounts_extension',
      },
    ]

    // When
    const customSections = deploymentErrorsToCustomSections(
      errors as any as AppDeploySchema['appDeploy']['userErrors'],
      {},
      appModules,
    )

    // Then
    expect(customSections).toEqual([
      {
        title: 'my-payment-extension',
        body: [
          {
            list: {
              title: '\nValidation errors',
              items: [
                'supported_buyer_contexts.currency: must be a valid uppercase alpha-3 ISO 4217 value, invalid value: CADs',
                'name: is too long',
              ],
            },
          },
        ],
      },
      {
        title: 'my-discount-function',
        body: [
          {
            list: {
              title: '\nValidation errors',
              items: ['targeting.target: is required'],
            },
          },
        ],
      },
    ])
  })
})
