import {fetchAppRemoteConfiguration} from './select-app.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {configurationSpecifications, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../dev/fetch.js')

const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

const webhooksActiveAppModule: AppModuleVersion = {
  registrationId: 'C_A',
  registrationUuid: 'UUID_C_A',
  registrationTitle: 'Registration title',
  type: 'Module:Webhooks',
  config: JSON.stringify({api_version: '2023-04'}),
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
  config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
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
  config: JSON.stringify({name: 'name'}),
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
  app: {
    activeAppVersion: {
      appModuleVersions: [webhooksActiveAppModule, homeActiveAppModule, brandingActiveAppModule],
    },
  },
}

describe('fetchAppRemoteConfiguration', () => {
  test('when configuration modules are present the remote configuration is returned ', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      activeAppVersion: (_appId: string) => Promise.resolve(activeVersion),
    })

    // When
    const result = await fetchAppRemoteConfiguration(
      'token',
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
      config: JSON.stringify({
        customers_redact_url: 'https://myapp.com/redact',
        customers_data_request_url: 'https://myapp.com/data_request',
        shop_redact_url: 'https://myapp.com/shop_redact',
      }),
      specification: {
        identifier: 'privacy_compliance_webhooks',
        name: 'privacy compliance webhooks',
        experience: 'configuration',
        options: {
          managementExperience: 'cli',
        },
      },
    }
    activeVersion.app.activeAppVersion.appModuleVersions.push(complianceActiveAppModule)
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      activeAppVersion: (_appId: string) => Promise.resolve(activeVersion),
    })

    // When
    const result = await fetchAppRemoteConfiguration(
      'token',
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
        privacy_compliance: {
          customer_deletion_url: 'https://myapp.com/redact',
          customer_data_request_url: 'https://myapp.com/data_request',
          shop_deletion_url: 'https://myapp.com/shop_redact',
        },
      },
    })
  })
})
