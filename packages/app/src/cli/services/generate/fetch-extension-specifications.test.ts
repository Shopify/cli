import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('fetchExtensionSpecifications', () => {
  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('skips a remote-only specification with an invalid contract schema', async () => {
    // Given
    const invalidRemoteSpecification: RemoteSpecification = {
      name: 'Invalid remote extension',
      externalName: 'Invalid Remote Extension',
      identifier: 'invalid_remote_extension',
      externalIdentifier: 'invalid_remote_extension',
      gated: false,
      experience: 'extension',
      managementExperience: 'cli',
      registrationLimit: 1,
      uidStrategy: 'uuid',
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"name":{"$ref":"#/definitions/missing"}}}',
      },
    }
    const validRemoteSpecification: RemoteSpecification = {
      name: 'Valid remote extension',
      externalName: 'Valid Remote Extension',
      identifier: 'valid_remote_extension',
      externalIdentifier: 'valid_remote_extension',
      gated: false,
      experience: 'extension',
      managementExperience: 'cli',
      registrationLimit: 1,
      uidStrategy: 'uuid',
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"name":{"type":"string"}}}',
      },
    }
    const outputMock = mockAndCaptureOutput()
    const developerPlatformClient = testDeveloperPlatformClient({
      specifications: () => Promise.resolve([invalidRemoteSpecification, validRemoteSpecification]),
    })

    // When
    const specifications = await fetchSpecifications({
      developerPlatformClient,
      app: testOrganizationApp(),
    })

    // Then
    expect(specifications).not.toContainEqual(
      expect.objectContaining({identifier: invalidRemoteSpecification.identifier}),
    )
    expect(specifications).toContainEqual(expect.objectContaining({identifier: validRemoteSpecification.identifier}))
    expect(outputMock.warn()).toContain(
      `Remote contract validation for "${invalidRemoteSpecification.identifier}" is skipped`,
    )
    expect(outputMock.warn()).toContain('Server-side validation remains the authority.')
  })

  test('returns the filtered and mapped results including theme', async () => {
    // Given/When
    const got = await fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient(),
      app: testOrganizationApp(),
    })

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Post-purchase UI',
          identifier: 'checkout_post_purchase',
          externalIdentifier: 'checkout_post_purchase_external',
          registrationLimit: 1,
          surface: 'post_purchase',
        }),
      ]),
    )

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Webhook Subscription',
          identifier: 'webhook_subscription',
          externalIdentifier: 'webhook_subscription',
          registrationLimit: 1,
          experience: 'configuration',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'UI Extension',
          identifier: 'ui_extension',
          externalIdentifier: 'ui_extension_external',
          registrationLimit: 50,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Theme App Extension',
          identifier: 'theme',
          externalIdentifier: 'theme_external',
          registrationLimit: 1,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identifier: 'remote_only_extension_schema',
          uidStrategy: 'uuid',
        }),
        expect.objectContaining({
          identifier: 'remote_only_extension_schema_with_localization',
          uidStrategy: 'uuid',
        }),
        expect.not.objectContaining({
          identifier: 'remote_only_extension_without_schema',
        }),
        expect.objectContaining({
          identifier: 'remote_only_extension_schema_config_style',
          uidStrategy: 'single',
        }),
      ]),
    )

    const withoutLocalization = got.find((spec) => spec.identifier === 'remote_only_extension_schema')
    const withLocalization = got.find((spec) => spec.identifier === 'remote_only_extension_schema_with_localization')

    expect(withoutLocalization?.appModuleFeatures()).toEqual([])
    expect(withLocalization?.appModuleFeatures()).toEqual(['localization'])
  })
})
