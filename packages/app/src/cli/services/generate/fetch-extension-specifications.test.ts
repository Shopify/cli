import {fetchSpecifications} from './fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('fetchExtensionSpecifications', () => {
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

  test('uses the remote App Events contract with the local dev session message', async () => {
    // Given
    const analyticsAppEventsRemoteSpec: RemoteSpecification = {
      name: 'App Events',
      externalName: 'App Events',
      identifier: 'analytics_app_events',
      externalIdentifier: 'analytics_app_events',
      gated: false,
      experience: 'extension',
      managementExperience: 'cli',
      registrationLimit: 1,
      uidStrategy: 'single',
      validationSchema: {
        jsonSchema:
          '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"namespace":{"type":"string"},"events":{"type":"array"}},"required":["namespace","events"]}',
      },
    }
    const developerPlatformClient = testDeveloperPlatformClient({
      specifications: () => Promise.resolve([analyticsAppEventsRemoteSpec]),
    })

    // When
    const specifications = await fetchSpecifications({
      developerPlatformClient,
      app: testOrganizationApp(),
    })
    const analyticsAppEventsSpec = specifications.find(
      (specification) => specification.identifier === 'analytics_app_events',
    )!

    // Then
    expect(analyticsAppEventsSpec.uidStrategy).toBe('single')
    await expect(analyticsAppEventsSpec.getDevSessionUpdateMessages!({})).resolves.toEqual(['Extension loaded'])
    expect(analyticsAppEventsSpec.parseConfigurationObject({namespace: 'example-app', events: []}).state).toBe('ok')
    expect(analyticsAppEventsSpec.parseConfigurationObject({namespace: 'example-app'}).state).toBe('error')
  })
})
