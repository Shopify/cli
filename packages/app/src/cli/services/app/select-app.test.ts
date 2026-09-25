import {fetchAppRemoteConfiguration, remoteAppConfigurationExtensionContent} from './select-app.js'
import {configurationSpecifications, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {AppModuleVersion, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers, MinimalOrganizationApp} from '../../models/organization.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../dev/fetch.js')

const webhooksActiveAppModule: AppModuleVersion = {
  registrationId: 'C_A',
  registrationUuid: 'UUID_C_A',
  registrationTitle: 'Registration title',
  type: 'Module:Webhooks',
  config: {api_version: '2023-04'},
  specification: {
    identifier: 'webhooks',
    name: 'webhooks',
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
    },
  },
}
const homeActiveAppModule: AppModuleVersion = {
  registrationId: 'C_B',
  registrationUuid: 'UUID_C_B',
  registrationTitle: 'Registration title',
  type: 'Module:AppHome',
  config: {app_url: 'https://myapp.com', embedded: true},
  specification: {
    identifier: 'app_home',
    name: 'App Home',
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
    },
  },
}
const brandingActiveAppModule: AppModuleVersion = {
  registrationId: 'C_C',
  registrationUuid: 'UUID_C_C',
  registrationTitle: 'Registration title',
  type: 'Module:Branding',
  config: {name: 'name'},
  specification: {
    identifier: 'branding',
    name: 'Branding',
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
    },
  },
}
const activeVersion = {
  appModuleVersions: [webhooksActiveAppModule, homeActiveAppModule, brandingActiveAppModule],
}
const minimalOrganizationApp: MinimalOrganizationApp = {
  id: '12345',
  title: 'My App',
  apiKey: 'API_KEY',
  organizationId: '67890',
}

describe('fetchAppRemoteConfiguration', () => {
  test('when configuration modules are present the remote configuration is returned ', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(activeVersion),
    })

    // When
    const result = await fetchAppRemoteConfiguration(
      minimalOrganizationApp,
      developerPlatformClient,
      await configurationSpecifications(),
      [],
    )

    // Then
    expect(result).toEqual({
      name: 'name',
      application_url: 'https://myapp.com',
      embedded: true,
      webhooks: {
        api_version: '2023-04',
      },
    })
  })

  test('when two configuration modules are under the same section the remote configuration is returned deep merged', async () => {
    const complianceActiveAppModule: AppModuleVersion = {
      registrationId: 'C_B',
      registrationUuid: 'UUID_C_B',
      registrationTitle: 'Registration title',
      type: 'Module:Privacy',
      config: {
        customers_redact_url: 'https://myapp.com/redact',
        customers_data_request_url: 'https://myapp.com/data_request',
        shop_redact_url: 'https://myapp.com/shop_redact',
      },
      specification: {
        identifier: 'privacy_compliance_webhooks',
        name: 'privacy compliance webhooks',
        experience: 'configuration',
        options: {
          managementExperience: 'cli',
        },
      },
    }
    activeVersion.appModuleVersions.push(complianceActiveAppModule)
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(activeVersion),
    })

    // When
    const result = await fetchAppRemoteConfiguration(
      minimalOrganizationApp,
      developerPlatformClient,
      await configurationSpecifications(),
      [],
    )

    // Then
    expect(result).toEqual({
      name: 'name',
      application_url: 'https://myapp.com',
      embedded: true,
      webhooks: {
        api_version: '2023-04',
        privacy_compliance: undefined,
        subscriptions: [
          {
            compliance_topics: ['customers/data_request'],
            uri: 'https://myapp.com/data_request',
          },
          {
            compliance_topics: ['customers/redact'],
            uri: 'https://myapp.com/redact',
          },
          {
            compliance_topics: ['shop/redact'],
            uri: 'https://myapp.com/shop_redact',
          },
        ],
      },
    })
  })

  test('when no configuration modules are present undefined is returned ', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(undefined),
    })

    // When
    const result = await fetchAppRemoteConfiguration(
      minimalOrganizationApp,
      developerPlatformClient,
      await configurationSpecifications(),
      [],
    )

    // Then
    expect(result).toBeUndefined()
  })
})

describe('remoteAppConfigurationExtensionContent', () => {
  const eventsSpec = {
    identifier: 'events',
    name: 'Events',
    experience: 'configuration' as const,
    options: {
      managementExperience: 'cli' as const,
    },
  }

  test('populates subscription handle from module registrationTitle when missing on single-subscription modules', async () => {
    const specs = await configurationSpecifications()
    const moduleOne: AppModuleVersion = {
      registrationId: 'MOD_1',
      registrationUuid: 'UUID_1',
      registrationTitle: 'order-notifier',
      type: 'Module:Events',
      config: {
        events: {
          api_version: '2024-01',
          subscription: {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
          },
        },
      },
      specification: eventsSpec,
    }
    const moduleTwo: AppModuleVersion = {
      registrationId: 'MOD_2',
      registrationUuid: 'UUID_2',
      registrationTitle: 'product-sync',
      type: 'Module:Events',
      config: {
        events: {
          api_version: '2024-01',
          subscription: {
            topic: 'products/update',
            uri: 'https://example.com/products',
            actions: ['update'],
          },
        },
      },
      specification: eventsSpec,
    }

    const result = remoteAppConfigurationExtensionContent([moduleOne, moduleTwo], specs, [])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
            handle: 'order-notifier',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/products',
            actions: ['update'],
            handle: 'product-sync',
          },
        ],
      },
    })
  })

  test('leaves subscription unnamed when module registrationTitle is the default events handle', async () => {
    const specs = await configurationSpecifications()
    const moduleOne: AppModuleVersion = {
      registrationId: 'MOD_1',
      registrationUuid: 'UUID_1',
      registrationTitle: 'events',
      type: 'Module:Events',
      config: {
        events: {
          api_version: '2024-01',
          subscription: {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
          },
        },
      },
      specification: eventsSpec,
    }

    const result = remoteAppConfigurationExtensionContent([moduleOne], specs, [])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
          },
        ],
      },
    })
  })

  test('merging a populated events module followed by a null-subscription module preserves subscriptions', async () => {
    const specs = await configurationSpecifications()
    const populatedModule: AppModuleVersion = {
      registrationId: 'MOD_1',
      registrationUuid: 'UUID_1',
      registrationTitle: 'order-notifier',
      type: 'Module:Events',
      config: {
        events: {
          api_version: '2024-01',
          subscription: {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
          },
        },
      },
      specification: eventsSpec,
    }
    const nullModule: AppModuleVersion = {
      registrationId: 'MOD_2',
      registrationUuid: 'UUID_2',
      registrationTitle: 'empty-events',
      type: 'Module:Events',
      config: {
        events: {
          api_version: '2024-01',
          subscription: null,
        },
      },
      specification: eventsSpec,
    }

    const result = remoteAppConfigurationExtensionContent([populatedModule, nullModule], specs, [])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/orders',
            actions: ['create'],
            handle: 'order-notifier',
          },
        ],
      },
    })
  })
})
