import {fetchAppRemoteConfiguration} from './select-app.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {fetchActiveAppVersion} from '../dev/fetch.js'
import {configurationSpecifications} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../dev/fetch.js')

describe('fetchAppRemoteConfiguration', () => {
  test('when configuration modules are present the remote configuration is returned ', async () => {
    const configActiveAppModule: AppModuleVersion = {
      registrationId: 'C_A',
      registrationUuid: 'UUID_C_A',
      registrationTitle: 'Registration title',
      type: 'app_home',
      config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
      specification: {
        identifier: 'app_home',
        name: 'App Ui',
        experience: 'configuration',
        options: {
          managementExperience: 'cli',
        },
      },
    }
    const activeVersion = {
      app: {
        activeAppVersion: {
          appModuleVersions: [configActiveAppModule],
        },
      },
    }
    vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

    // When
    const result = await fetchAppRemoteConfiguration('token', 'apiKey', await configurationSpecifications())

    // Then
    expect(result).toEqual({
      application_url: 'https://myapp.com',
      embedded: true,
    })
  })

  test('when no configuration modules are present the remote configuration is returned empty', async () => {
    const checkoutModule: AppModuleVersion = {
      registrationId: 'A',
      registrationUuid: 'UUID_A',
      registrationTitle: 'Checkout post purchase',
      type: 'post_purchase_ui_extension',
      specification: {
        identifier: 'post_purchase_ui_extension',
        name: 'Post purchase UI extension',
        experience: 'extension',
        options: {
          managementExperience: 'cli',
        },
      },
    }
    const activeVersion = {
      app: {
        activeAppVersion: {
          appModuleVersions: [checkoutModule],
        },
      },
    }
    vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

    // When
    const result = await fetchAppRemoteConfiguration('token', 'apiKey', await configurationSpecifications())

    // Then
    expect(result).toEqual({})
  })

  test('when two configuration modules are under the same section the remote configuration is returned deep merged', async () => {
    const webhooksActiveAppModule: AppModuleVersion = {
      registrationId: 'C_A',
      registrationUuid: 'UUID_C_A',
      registrationTitle: 'Registration title',
      type: 'webhooks',
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
    const complianceActiveAppModule: AppModuleVersion = {
      registrationId: 'C_B',
      registrationUuid: 'UUID_C_B',
      registrationTitle: 'Registration title',
      type: 'privacy_compliance_webhooks',
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
    const activeVersion = {
      app: {
        activeAppVersion: {
          appModuleVersions: [webhooksActiveAppModule, complianceActiveAppModule],
        },
      },
    }
    vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

    // When
    const result = await fetchAppRemoteConfiguration('token', 'apiKey', await configurationSpecifications())

    // Then
    expect(result).toEqual({
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
