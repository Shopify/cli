import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {describe, expect, test} from 'vitest'

describe('fetchExtensionSpecifications', () => {
  test('strips extra root configuration properties defined by the remote contract', async () => {
    // Given
    const specifications = await fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient(),
      app: testOrganizationApp(),
    })
    const specification = specifications.find((spec) => spec.identifier === 'remote_only_extension_schema_config_style')

    // When
    const result = specification!.parseConfigurationObject({pattern: 'pattern', extra: 'extra'})

    // Then
    expect(result).toEqual({
      state: 'ok',
      data: {pattern: 'pattern'},
      errors: undefined,
    })
  })

  test('rejects extra root extension properties defined by the remote contract', async () => {
    // Given
    const specifications = await fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient(),
      app: testOrganizationApp(),
    })
    const specification = specifications.find((spec) => spec.identifier === 'remote_only_extension_schema')

    // When
    const result = specification!.parseConfigurationObject({pattern: 'pattern', extra: 'extra'})

    // Then
    expect(result.state).toBe('error')
    expect(result.errors).toContainEqual(
      expect.objectContaining({path: ['extra'], message: expect.stringContaining('No additional properties allowed')}),
    )
  })

  test('retains remote required fields for configuration modules', async () => {
    // Given
    const remoteSpecification: RemoteSpecification = {
      name: 'Required configuration module',
      externalName: 'Required Configuration Module',
      identifier: 'remote_configuration_with_required_field',
      externalIdentifier: 'remote_configuration_with_required_field',
      gated: false,
      experience: 'configuration',
      managementExperience: 'cli',
      registrationLimit: 1,
      uidStrategy: 'single',
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"section":{"type":"object"}},"required":["section"]}',
      },
    }
    const specifications = await fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient({
        specifications: () => Promise.resolve([remoteSpecification]),
      }),
      app: testOrganizationApp(),
    })
    const specification = specifications.find((spec) => spec.identifier === remoteSpecification.identifier)

    // When
    const result = specification!.parseConfigurationObject({})

    // Then
    // This documents the existing strip-policy gap; it does not endorse required fields in remote contracts.
    expect(result).toEqual({
      state: 'error',
      data: undefined,
      errors: [{path: ['section'], message: 'Required'}],
    })
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
