import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {DEFAULT_DEV_SESSION_UPDATE_MESSAGE, ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {BaseConfigType} from '../../models/extensions/schemas.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
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
})

describe('getDevSessionUpdateMessages for remotely-sourced specifications', () => {
  const analyticsAppEventsRemoteSpec: RemoteSpecification = {
    name: 'Analytics App Events',
    externalName: 'Analytics App Events',
    identifier: 'analytics_app_events',
    externalIdentifier: 'analytics_app_events_external',
    gated: false,
    experience: 'extension',
    managementExperience: 'cli',
    registrationLimit: 1,
    uidStrategy: 'single',
    validationSchema: {
      jsonSchema:
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"name":{"type":"string"}}}',
    },
  }

  function instanceFor(specification: ExtensionSpecification): ExtensionInstance {
    return new ExtensionInstance({
      configuration: {name: 'analytics app events', type: specification.identifier} as BaseConfigType,
      configurationPath: '',
      directory: '/tmp/test-extension',
      specification,
    })
  }

  async function specificationsFor(remoteSpecs: RemoteSpecification[]): Promise<ExtensionSpecification[]> {
    return fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient({specifications: () => Promise.resolve(remoteSpecs)}),
      app: testOrganizationApp(),
    })
  }

  test('a remote-only specification with no local dev output gets the default message', async () => {
    // Given
    const specifications = await specificationsFor([analyticsAppEventsRemoteSpec])
    const specification = specifications.find((spec) => spec.identifier === 'analytics_app_events')!

    // Then
    expect(specification.experience).toBe('extension')
    expect(specification.uidStrategy).toBe('single')
    expect(specification.appModuleFeatures()).toEqual([])
    await expect(instanceFor(specification).getDevSessionUpdateMessages({status: 'created'})).resolves.toEqual([
      DEFAULT_DEV_SESSION_UPDATE_MESSAGE,
    ])
  })

  test('a remote-only specification with localization does not get the default message', async () => {
    // A known, accepted consequence of the predicate: `localization` counts as a feature.
    const specifications = await specificationsFor([
      {
        ...analyticsAppEventsRemoteSpec,
        identifier: 'remote_only_with_localization',
        validationSchema: {
          jsonSchema:
            '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"localization":{"type":"object"}}}',
        },
      },
    ])
    const specification = specifications.find((spec) => spec.identifier === 'remote_only_with_localization')!

    expect(specification.appModuleFeatures()).toEqual(['localization'])
    await expect(instanceFor(specification).getDevSessionUpdateMessages({status: 'created'})).resolves.toBeUndefined()
  })

  test('merging a local specification with its remote counterpart preserves a per-specification override', async () => {
    const specifications = await specificationsFor([
      {
        ...analyticsAppEventsRemoteSpec,
        name: 'App Home',
        identifier: 'app_home',
        externalIdentifier: 'app_home_external',
        experience: 'configuration',
      },
    ])
    const specification = specifications.find((spec) => spec.identifier === 'app_home')!

    expect(specification.getDevSessionUpdateMessages).toBeDefined()
    await expect(
      specification.getDevSessionUpdateMessages!({application_url: 'https://example.com'} as BaseConfigType, {
        status: 'created',
      }),
    ).resolves.toEqual(['Using URL: https://example.com'])
  })
})
